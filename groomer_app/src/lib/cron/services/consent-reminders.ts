import { sendLineMessage } from '@/lib/line'
import { createConsentToken, hashConsentToken } from '@/lib/consents/shared'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  resolveConsentReminderAppBaseUrl,
  shouldSendConsentReminder,
  type ConsentReminderType,
} from '@/lib/cron/services/consent-reminders-core'

type ConsentDocumentRow = {
  id: string
  store_id: string
  customer_id: string
  status: string
  created_at: string
  token_expires_at: string | null
}

export async function runConsentRemindersJob() {
  const admin = createAdminSupabaseClient()
  const appBaseUrl = resolveConsentReminderAppBaseUrl({
    APP_BASE_URL: process.env.APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })
  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL or NEXT_PUBLIC_APP_URL is required for consent reminders.')
  }

  const nowIso = new Date().toISOString()
  const nowMs = Date.now()
  const reminderTypes: ConsentReminderType[] = ['after_24h', 'after_72h', 'before_expiry']

  const { data: docs, error: docsError } = await admin
    .from('consent_documents' as never)
    .select('id, store_id, customer_id, status, created_at, token_expires_at')
    .in('status', ['draft', 'sent'])
    .not('customer_id', 'is', null)
    .not('store_id', 'is', null)
    .order('created_at', { ascending: true })

  if (docsError) throw new Error(docsError.message)
  const candidates = (docs ?? []) as ConsentDocumentRow[]

  const docIds = candidates.map((row) => row.id)
  const existingReminderKeys = new Set<string>()
  if (docIds.length > 0) {
    const { data: logs } = await admin
      .from('consent_delivery_logs' as never)
      .select('document_id, payload')
      .in('document_id', docIds)
      .eq('channel', 'line')
      .in('status', ['sent', 'delivered'])

    ;((logs ?? []) as Array<{ document_id: string; payload?: { reminder_type?: string } | null }>).forEach((row) => {
      const reminderType = row.payload?.reminder_type
      if (row.document_id && reminderType) {
        existingReminderKeys.add(`${row.document_id}:${reminderType}`)
      }
    })
  }

  let scanned = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const doc of candidates) {
    scanned += 1

    const { data: customer } = await admin
      .from('customers')
      .select('full_name, line_id')
      .eq('id', doc.customer_id)
      .eq('store_id', doc.store_id)
      .maybeSingle()
    const lineId = customer?.line_id as string | null
    if (!lineId) {
      skipped += 1
      continue
    }

    for (const reminderType of reminderTypes) {
      const dedupeKey = `${doc.id}:${reminderType}`
      if (existingReminderKeys.has(dedupeKey)) continue
      if (
        !shouldSendConsentReminder({
          type: reminderType,
          createdAt: doc.created_at,
          tokenExpiresAt: doc.token_expires_at,
          nowMs,
        })
      ) {
        continue
      }

      const token = createConsentToken()
      const tokenHash = hashConsentToken(token)
      const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      const signUrl = `${appBaseUrl}/consent/sign/${token}`

      const { error: tokenUpdateError } = await admin
        .from('consent_documents' as never)
        .update({
          sign_token_hash: tokenHash,
          token_expires_at: tokenExpiresAt,
          status: 'sent',
          updated_at: nowIso,
        } as never)
        .eq('id', doc.id)
        .eq('store_id', doc.store_id)
      if (tokenUpdateError) {
        failed += 1
        continue
      }

      const reminderLabel =
        reminderType === 'after_24h'
          ? '24時間リマインド'
          : reminderType === 'after_72h'
            ? '72時間リマインド'
            : '期限前日リマインド'
      const text = `${customer?.full_name ?? 'お客様'}様\n施術同意書へのご署名が未完了です。\n(${reminderLabel})\n${signUrl}`
      const sendResult = await sendLineMessage({
        to: lineId,
        messages: [{ type: 'text', text }],
      })

      await admin.from('consent_delivery_logs' as never).insert({
        store_id: doc.store_id,
        document_id: doc.id,
        channel: 'line',
        target: lineId,
        status: sendResult.success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        error_message: sendResult.success ? null : sendResult.error ?? null,
        payload: {
          reminder_type: reminderType,
          sign_url: signUrl,
        } as never,
      } as never)

      if (sendResult.success) {
        sent += 1
        existingReminderKeys.add(dedupeKey)
      } else {
        failed += 1
      }
    }
  }

  return {
    scanned,
    sent,
    skipped,
    failed,
  }
}
