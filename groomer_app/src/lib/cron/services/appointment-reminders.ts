import { sendLineMessage } from '@/lib/line'
import { sendEmail } from '@/lib/resend'
import { renderReminderTemplate } from '@/lib/notification-templates'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  addDaysToJstDate,
  buildJstDayWindowIso,
  getJstDate,
  getJstNowParts,
  makeReminderDedupeKey,
  shouldSendReminderNow,
  toStoreNotificationSettings,
  type ReminderChannel,
  type ReminderTiming,
  type StoreNotificationSettings,
  type StoreNotificationSettingsRow,
} from './appointment-reminders-core'

type AppointmentRow = {
  id: string
  group_id: string | null
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

type ReminderCandidate = AppointmentRow & {
  timing: ReminderTiming
  appointmentDateJst: string
}

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
  timing: ReminderTiming
  channel: ReminderChannel
  target: string
  dedupeKey: string
  templateKey: string
  menu: string
}) {
  const { admin, storeId, customerId, appointmentId, timing, channel, target, dedupeKey, templateKey, menu } = params
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
        timing,
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
  timing: ReminderTiming
  subject: string
  body: string
  status: 'sent' | 'failed'
  templateKey: string
  menu: string
  target: string
  reason?: string
}) {
  const { admin, logId, timing, subject, body, status, templateKey, menu, target, reason } = params
  const { error } = await admin
    .from('customer_notification_logs')
    .update({
      status,
      subject,
      body,
      payload: {
        template_key: templateKey,
        timing,
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
  const { todayJst, currentHourJst } = getJstNowParts()
  const tomorrowJst = addDaysToJstDate(todayJst, 1)
  const todayWindow = buildJstDayWindowIso(todayJst)
  const tomorrowWindow = buildJstDayWindowIso(tomorrowJst)
  const startOfWindow = todayWindow.start < tomorrowWindow.start ? todayWindow.start : tomorrowWindow.start
  const endOfWindow = todayWindow.end > tomorrowWindow.end ? todayWindow.end : tomorrowWindow.end

  const { data: upcomingAppointments, error: appointmentsError } = await admin
    .from('appointments')
    .select('id, group_id, start_time, menu, customer_id, store_id')
    .gte('start_time', startOfWindow)
    .lte('start_time', endOfWindow)
    .eq('status', '予約済')
    .not('store_id', 'is', null)

  if (appointmentsError) {
    throw new Error('Failed to fetch appointments')
  }

  const appointments = (upcomingAppointments ?? []) as AppointmentRow[]
  const uniqueStoreIds = Array.from(new Set(appointments.map((appointment) => appointment.store_id)))
  const storeNameMap = new Map<string, string>()
  const settingsByStoreId = new Map<string, StoreNotificationSettings>()

  if (uniqueStoreIds.length > 0) {
    const { data: settingsRows } = await admin
      .from('store_notification_settings')
      .select(
        'store_id, reminder_line_enabled, reminder_email_enabled, reminder_day_before_enabled, reminder_same_day_enabled, reminder_day_before_send_hour_jst, reminder_same_day_send_hour_jst'
      )
      .in('store_id', uniqueStoreIds)
    for (const row of (settingsRows ?? []) as StoreNotificationSettingsRow[]) {
      settingsByStoreId.set(row.store_id, toStoreNotificationSettings(row))
    }
  }

  const reminderCandidates: ReminderCandidate[] = []
  for (const appointment of appointments) {
    const appointmentDateJst = getJstDate(appointment.start_time)
    if (!appointmentDateJst) continue

    let timing: ReminderTiming | null = null
    if (appointmentDateJst === todayJst) timing = 'same_day'
    if (appointmentDateJst === tomorrowJst) timing = 'day_before'
    if (!timing) continue

    const settings = settingsByStoreId.get(appointment.store_id) ?? DEFAULT_NOTIFICATION_SETTINGS
    if (!shouldSendReminderNow({ settings, timing, currentHourJst })) {
      continue
    }

    reminderCandidates.push({
      ...appointment,
      timing,
      appointmentDateJst,
    })
  }

  const candidateAppointmentIds = reminderCandidates.map((appointment) => appointment.id)

  if (uniqueStoreIds.length > 0) {
    const { data: stores } = await admin.from('stores').select('id, name').in('id', uniqueStoreIds)
    for (const store of (stores ?? []) as StoreRow[]) {
      storeNameMap.set(store.id, store.name ?? '店舗名未設定')
    }
  }
  const existingDedupeKeys = new Set<string>()
  if (candidateAppointmentIds.length > 0) {
    const dedupeKeys = reminderCandidates.flatMap((appointment) => [
      makeReminderDedupeKey({
        timing: appointment.timing,
        channel: 'line',
        appointmentId: appointment.id,
        appointmentDateJst: appointment.appointmentDateJst,
        groupId: appointment.group_id,
      }),
      makeReminderDedupeKey({
        timing: appointment.timing,
        channel: 'email',
        appointmentId: appointment.id,
        appointmentDateJst: appointment.appointmentDateJst,
        groupId: appointment.group_id,
      }),
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
    disabled_channel: 0,
    missing_customer: 0,
    missing_line_target: 0,
    missing_email_target: 0,
  }
  const scannedByTiming = { day_before: 0, same_day: 0 }
  const sentByTiming = { day_before: 0, same_day: 0 }
  const notifiedStoreIds = new Set<string>()
  const notifiedAppointmentIds: string[] = []

  for (const appointment of reminderCandidates) {
    scannedByTiming[appointment.timing] += 1
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
    const settings = settingsByStoreId.get(appointment.store_id) ?? DEFAULT_NOTIFICATION_SETTINGS

    if (!settings.reminderLineEnabled) {
      skipped += 1
      skippedBreakdown.disabled_channel += 1
    } else if (customerData.line_id) {
      const lineDedupeKey = makeReminderDedupeKey({
        timing: appointment.timing,
        channel: 'line',
        appointmentId: appointment.id,
        appointmentDateJst: appointment.appointmentDateJst,
        groupId: appointment.group_id,
      })
      if (existingDedupeKeys.has(lineDedupeKey)) {
        skipped += 1
        skippedBreakdown.dedupe += 1
      } else {
        const reservation = await reserveReminderNotificationLog({
          admin,
          storeId: appointment.store_id,
          customerId: appointment.customer_id,
          appointmentId: appointment.id,
          timing: appointment.timing,
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
              timing: appointment.timing,
              status: 'sent',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_line',
              menu: appointment.menu,
              target: customerData.line_id,
            })
            existingDedupeKeys.add(lineDedupeKey)
            sent += 1
            sentByTiming[appointment.timing] += 1
            notifiedStoreIds.add(appointment.store_id)
            notifiedAppointmentIds.push(appointment.id)
          } catch (error) {
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              timing: appointment.timing,
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

    if (!settings.reminderEmailEnabled) {
      skipped += 1
      skippedBreakdown.disabled_channel += 1
    } else if (customerData.email) {
      const emailDedupeKey = makeReminderDedupeKey({
        timing: appointment.timing,
        channel: 'email',
        appointmentId: appointment.id,
        appointmentDateJst: appointment.appointmentDateJst,
        groupId: appointment.group_id,
      })
      if (existingDedupeKeys.has(emailDedupeKey)) {
        skipped += 1
        skippedBreakdown.dedupe += 1
      } else {
        const reservation = await reserveReminderNotificationLog({
          admin,
          storeId: appointment.store_id,
          customerId: appointment.customer_id,
          appointmentId: appointment.id,
          timing: appointment.timing,
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
              timing: appointment.timing,
              status: 'sent',
              subject: rendered.subject,
              body: rendered.body,
              templateKey: 'reminder_email',
              menu: appointment.menu,
              target: customerData.email,
            })
            existingDedupeKeys.add(emailDedupeKey)
            sent += 1
            sentByTiming[appointment.timing] += 1
            notifiedStoreIds.add(appointment.store_id)
            notifiedAppointmentIds.push(appointment.id)
          } catch (error) {
            await finalizeReminderNotificationLog({
              admin,
              logId: reservation.logId,
              timing: appointment.timing,
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
    scanned: reminderCandidates.length,
    sent,
    skipped,
    counters: {
      scanned: reminderCandidates.length,
      sent,
      skipped,
      storesNotified: notifiedStoreIds.size,
      scannedByTiming,
      sentByTiming,
      skippedBreakdown,
    },
    skippedBreakdown,
    notifiedStoreIds: Array.from(notifiedStoreIds),
    sampleAppointmentIds: notifiedAppointmentIds.slice(0, 20),
  }
}
