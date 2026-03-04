import { format, addDays } from 'date-fns'
import { sendLineMessage } from '@/lib/line'
import { sendEmail } from '@/lib/resend'
import { renderReminderTemplate } from '@/lib/notification-templates'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type AppointmentRow = {
  id: string
  start_time: string
  menu: string
  customer_id: string | null
  store_id: string
}

type CustomerRow = {
  full_name: string
  line_id: string | null
  email: string | null
}

type StoreRow = {
  id: string
  name: string | null
}

type TemplateRow = {
  store_id: string
  template_key: string
  channel: string
  subject: string | null
  body: string
  is_active: boolean
}

type ReminderChannel = 'line' | 'email'

function isDuplicateKeyError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  if (error.code === '23505') return true
  return error.message?.includes('duplicate key') ?? false
}

async function reserveReminderNotificationLog(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
  customerId: string
  appointmentId: string
  channel: ReminderChannel
  target: string
  dedupeKey: string
  templateKey: string
  menu: string
}) {
  const { admin, storeId, customerId, appointmentId, channel, target, dedupeKey, templateKey, menu } = params
  const queuedAt = new Date().toISOString()
  const { data, error } = await admin
    .from('customer_notification_logs')
    .insert({
      store_id: storeId,
      customer_id: customerId,
      appointment_id: appointmentId,
      channel,
      notification_type: 'reminder',
      status: 'queued',
      target,
      dedupe_key: dedupeKey,
      payload: {
        template_key: templateKey,
        menu,
        target,
        reservation_status: 'queued',
      },
      sent_at: queuedAt,
    })
    .select('id')
    .single()

  if (error) {
    if (isDuplicateKeyError(error)) {
      return { status: 'duplicate' as const, logId: null }
    }
    throw new Error(error.message)
  }

  return { status: 'reserved' as const, logId: data?.id ?? null }
}

async function finalizeReminderNotificationLog(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  logId: string
  subject: string
  body: string
  status: 'sent' | 'failed'
  templateKey: string
  menu: string
  target: string
  reason?: string
}) {
  const { admin, logId, subject, body, status, templateKey, menu, target, reason } = params
  const { error } = await admin
    .from('customer_notification_logs')
    .update({
      status,
      subject,
      body,
      payload: {
        template_key: templateKey,
        menu,
        target,
        notification_status: status,
        ...(reason ? { reason } : {}),
      },
      sent_at: new Date().toISOString(),
    })
    .eq('id', logId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function runAppointmentRemindersJob() {
  const admin = createAdminSupabaseClient()
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const startOfDay = `${tomorrow}T00:00:00.000Z`
  const endOfDay = `${tomorrow}T23:59:59.999Z`

  const { data: upcomingAppointments, error: appointmentsError } = await admin
    .from('appointments')
    .select('id, start_time, menu, customer_id, store_id')
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('status', '予約済')
    .not('store_id', 'is', null)

  if (appointmentsError) {
    throw new Error('Failed to fetch appointments')
  }

  const appointments = (upcomingAppointments ?? []) as AppointmentRow[]
  const uniqueStoreIds = Array.from(new Set(appointments.map((appointment) => appointment.store_id)))
  const appointmentIds = appointments.map((appointment) => appointment.id)
  const storeNameMap = new Map<string, string>()

  if (uniqueStoreIds.length > 0) {
    const { data: stores } = await admin.from('stores').select('id, name').in('id', uniqueStoreIds)
    for (const store of (stores ?? []) as StoreRow[]) {
      storeNameMap.set(store.id, store.name ?? '店舗名未設定')
    }
  }
  const existingDedupeKeys = new Set<string>()
  if (appointmentIds.length > 0) {
    const dedupeKeys = appointments.flatMap((appointment) => [
      `reminder:line:${appointment.id}:${tomorrow}`,
      `reminder:email:${appointment.id}:${tomorrow}`,
    ])
    const { data: existingLogs } = await admin
      .from('customer_notification_logs')
      .select('dedupe_key')
      .in('dedupe_key', dedupeKeys)
    for (const row of (existingLogs ?? []) as Array<{ dedupe_key: string | null }>) {
      if (row.dedupe_key) existingDedupeKeys.add(row.dedupe_key)
    }
  }
  const templateMap = new Map<string, { subject: string | null; body: string }>()
  if (uniqueStoreIds.length > 0) {
    const { data: templates } = await admin
      .from('notification_templates')
      .select('store_id, template_key, channel, subject, body, is_active')
      .in('store_id', uniqueStoreIds)
      .in('template_key', ['reminder_line', 'reminder_email'])

    for (const template of (templates ?? []) as TemplateRow[]) {
      if (!template.is_active) continue
      templateMap.set(`${template.store_id}:${template.template_key}:${template.channel}`, {
        subject: template.subject,
        body: template.body,
      })
    }
  }

  let sent = 0
  let skipped = 0
  const skippedBreakdown = {
    dedupe: 0,
    failed: 0,
    missing_customer: 0,
    missing_line_target: 0,
    missing_email_target: 0,
  }
  const notifiedStoreIds = new Set<string>()
  const notifiedAppointmentIds: string[] = []

  for (const appointment of appointments) {
    if (!appointment.customer_id) {
      skipped += 1
      skippedBreakdown.missing_customer += 1
      continue
    }

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('full_name, line_id, email')
      .eq('id', appointment.customer_id)
      .eq('store_id', appointment.store_id)
      .maybeSingle()

    if (customerError || !customer) {
      skipped += 1
      skippedBreakdown.missing_customer += 1
      continue
    }

    const customerData = customer as CustomerRow
    const storeName = storeNameMap.get(appointment.store_id) ?? '店舗名未設定'
    const reminderLineTemplate = templateMap.get(`${appointment.store_id}:reminder_line:line`)
    const reminderEmailTemplate = templateMap.get(`${appointment.store_id}:reminder_email:email`)

    if (customerData.line_id) {
      const lineDedupeKey = `reminder:line:${appointment.id}:${tomorrow}`
      if (existingDedupeKeys.has(lineDedupeKey)) {
        skipped += 1
        skippedBreakdown.dedupe += 1
      } else {
        const reservation = await reserveReminderNotificationLog({
          admin,
          storeId: appointment.store_id,
          customerId: appointment.customer_id,
          appointmentId: appointment.id,
          channel: 'line',
          target: customerData.line_id,
          dedupeKey: lineDedupeKey,
          templateKey: 'reminder_line',
          menu: appointment.menu,
        })
        if (reservation.status === 'duplicate' || !reservation.logId) {
          existingDedupeKeys.add(lineDedupeKey)
          skipped += 1
          skippedBreakdown.dedupe += 1
        } else {
          const rendered = renderReminderTemplate({
            customerName: customerData.full_name,
            storeName,
            menu: appointment.menu,
            startTime: appointment.start_time,
            subjectTemplate: reminderLineTemplate?.subject,
            bodyTemplate: reminderLineTemplate?.body,
          })

          try {
            const lineResult = await sendLineMessage({
              to: customerData.line_id,
              messages: [{ type: 'text', text: rendered.body }],
            })
            if (!lineResult.success) {
              throw new Error(lineResult.error ?? 'line_send_failed')
            }
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              status: 'sent',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_line',
              menu: appointment.menu,
              target: customerData.line_id,
            })
            existingDedupeKeys.add(lineDedupeKey)
            sent += 1
            notifiedStoreIds.add(appointment.store_id)
            notifiedAppointmentIds.push(appointment.id)
          } catch (error) {
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              status: 'failed',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_line',
              menu: appointment.menu,
              target: customerData.line_id,
              reason: error instanceof Error ? error.message : 'send_failed',
            })
            skipped += 1
            skippedBreakdown.failed += 1
          }
        }
      }
    } else {
      skipped += 1
      skippedBreakdown.missing_line_target += 1
    }

    if (customerData.email) {
      const emailDedupeKey = `reminder:email:${appointment.id}:${tomorrow}`
      if (existingDedupeKeys.has(emailDedupeKey)) {
        skipped += 1
        skippedBreakdown.dedupe += 1
      } else {
        const reservation = await reserveReminderNotificationLog({
          admin,
          storeId: appointment.store_id,
          customerId: appointment.customer_id,
          appointmentId: appointment.id,
          channel: 'email',
          target: customerData.email,
          dedupeKey: emailDedupeKey,
          templateKey: 'reminder_email',
          menu: appointment.menu,
        })
        if (reservation.status === 'duplicate' || !reservation.logId) {
          existingDedupeKeys.add(emailDedupeKey)
          skipped += 1
          skippedBreakdown.dedupe += 1
        } else {
          const rendered = renderReminderTemplate({
            customerName: customerData.full_name,
            storeName,
            menu: appointment.menu,
            startTime: appointment.start_time,
            subjectTemplate: reminderEmailTemplate?.subject,
            bodyTemplate: reminderEmailTemplate?.body,
          })
          const emailHtml = rendered.body.replaceAll('\n', '<br />')

          try {
            const emailResult = await sendEmail({
              to: customerData.email,
              subject: rendered.subject,
              html: emailHtml,
            })
            if (!emailResult.success) {
              throw new Error(emailResult.error ?? 'email_send_failed')
            }
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              status: 'sent',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_email',
              menu: appointment.menu,
              target: customerData.email,
            })
            existingDedupeKeys.add(emailDedupeKey)
            sent += 1
            notifiedStoreIds.add(appointment.store_id)
            notifiedAppointmentIds.push(appointment.id)
          } catch (error) {
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              status: 'failed',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_email',
              menu: appointment.menu,
              target: customerData.email,
              reason: error instanceof Error ? error.message : 'send_failed',
            })
            skipped += 1
            skippedBreakdown.failed += 1
          }
        }
      }
    } else {
      skipped += 1
      skippedBreakdown.missing_email_target += 1
    }
  }

  return {
    scanned: appointments.length,
    sent,
    skipped,
    counters: {
      scanned: appointments.length,
      sent,
      skipped,
      storesNotified: notifiedStoreIds.size,
      skippedBreakdown,
    },
    skippedBreakdown,
    notifiedStoreIds: Array.from(notifiedStoreIds),
    sampleAppointmentIds: notifiedAppointmentIds.slice(0, 20),
  }
}
