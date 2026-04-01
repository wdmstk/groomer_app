import { sendLineMessage } from '@/lib/line'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { buildJournalLineBody } from '@/lib/cron/services/journal-line-notifications-core'

type JournalNotificationRow = {
  id: string
  store_id: string
  entry_id: string
  recipient_customer_id: string | null
}

type JournalEntryRow = {
  id: string
  body_text: string | null
  status: string
}

type CustomerRow = {
  id: string
  full_name: string | null
  line_id: string | null
}

type PetMapRow = {
  pet_id: string
}

type PetRow = {
  id: string
  name: string | null
}

async function updateJournalNotificationStatus(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  notificationId: string
  status: 'sent' | 'failed'
  errorCode?: string
}) {
  const { admin, notificationId, status, errorCode } = params
  await admin
    .from('journal_notifications')
    .update({
      status,
      sent_at: new Date().toISOString(),
      error_code: errorCode ?? null,
    })
    .eq('id', notificationId)
}

export async function runJournalLineNotificationsJob() {
  const admin = createAdminSupabaseClient()
  const batchSize = Number(process.env.JOURNAL_LINE_SEND_BATCH_SIZE ?? 50)
  const limit = Number.isFinite(batchSize) ? Math.max(1, Math.min(200, Math.floor(batchSize))) : 50

  const { data: queuedRows, error: queuedError } = await admin
    .from('journal_notifications')
    .select('id, store_id, entry_id, recipient_customer_id')
    .eq('channel', 'line')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (queuedError) {
    throw new Error(queuedError.message)
  }

  const rows = (queuedRows ?? []) as JournalNotificationRow[]
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.recipient_customer_id) {
      await updateJournalNotificationStatus({
        admin,
        notificationId: row.id,
        status: 'failed',
        errorCode: 'recipient_customer_missing',
      })
      failed += 1
      continue
    }

    const { data: entry, error: entryError } = await admin
      .from('journal_entries')
      .select('id, body_text, status')
      .eq('store_id', row.store_id)
      .eq('id', row.entry_id)
      .maybeSingle()

    if (entryError || !entry) {
      await updateJournalNotificationStatus({
        admin,
        notificationId: row.id,
        status: 'failed',
        errorCode: entryError?.message ?? 'entry_not_found',
      })
      failed += 1
      continue
    }

    const entryRow = entry as JournalEntryRow
    if (entryRow.status !== 'published') {
      skipped += 1
      continue
    }

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('id, full_name, line_id')
      .eq('store_id', row.store_id)
      .eq('id', row.recipient_customer_id)
      .maybeSingle()

    if (customerError || !customer) {
      await updateJournalNotificationStatus({
        admin,
        notificationId: row.id,
        status: 'failed',
        errorCode: customerError?.message ?? 'customer_not_found',
      })
      failed += 1
      continue
    }

    const customerRow = customer as CustomerRow
    if (!customerRow.line_id) {
      await updateJournalNotificationStatus({
        admin,
        notificationId: row.id,
        status: 'failed',
        errorCode: 'line_id_not_found',
      })
      failed += 1
      continue
    }

    const { data: petMaps } = await admin
      .from('journal_entry_pets')
      .select('pet_id')
      .eq('store_id', row.store_id)
      .eq('entry_id', row.entry_id)

    const petIds = ((petMaps ?? []) as PetMapRow[]).map((item) => item.pet_id).filter(Boolean)
    let petNames: string[] = []
    if (petIds.length > 0) {
      const { data: pets } = await admin
        .from('pets')
        .select('id, name')
        .eq('store_id', row.store_id)
        .in('id', petIds)
      petNames = ((pets ?? []) as PetRow[]).map((pet) => pet.name ?? '').filter((name) => name.length > 0)
    }

    const body = buildJournalLineBody({
      customerName: customerRow.full_name ?? 'お客様',
      petNames,
      bodyText: entryRow.body_text ?? '',
    })

    const { data: logRow } = await admin
      .from('customer_notification_logs')
      .insert({
        store_id: row.store_id,
        customer_id: customerRow.id,
        channel: 'line',
        notification_type: 'other',
        status: 'queued',
        subject: '日誌更新',
        body,
        target: customerRow.line_id,
        payload: {
          kind: 'journal_line_notification',
          journal_entry_id: row.entry_id,
          journal_notification_id: row.id,
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    const sendResult = await sendLineMessage({
      to: customerRow.line_id,
      messages: [{ type: 'text', text: body }],
    })

    if (!sendResult.success) {
      await updateJournalNotificationStatus({
        admin,
        notificationId: row.id,
        status: 'failed',
        errorCode: sendResult.error ?? 'line_send_failed',
      })
      if (logRow?.id) {
        await admin
          .from('customer_notification_logs')
          .update({
            status: 'failed',
            payload: {
              kind: 'journal_line_notification',
              journal_entry_id: row.entry_id,
              journal_notification_id: row.id,
              reason: sendResult.error ?? 'line_send_failed',
            },
            sent_at: new Date().toISOString(),
          })
          .eq('id', logRow.id)
      }
      failed += 1
      continue
    }

    await updateJournalNotificationStatus({
      admin,
      notificationId: row.id,
      status: 'sent',
    })

    if (logRow?.id) {
      await admin
        .from('customer_notification_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', logRow.id)
    }

    sent += 1
  }

  return {
    scanned: rows.length,
    sent,
    failed,
    skipped,
  }
}
