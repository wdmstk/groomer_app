import { NextResponse } from 'next/server'
import {
  assertFollowupTaskInStore,
  FOLLOWUP_EVENT_TYPES,
  getFollowupRouteContext,
  isResolvedStatus,
  jsonError,
  toOptionalString,
} from '@/lib/followups/shared'
import type { Database, Json } from '@/lib/supabase/database.types'
import { asJsonObject, asJsonObjectOrNull } from '@/lib/object-utils'

type RouteParams = {
  params: Promise<{
    followup_id: string
  }>
}

type FollowupEventInsert = Database['public']['Tables']['customer_followup_events']['Insert']
type FollowupTaskUpdate = Database['public']['Tables']['customer_followup_tasks']['Update']
type NotificationLogInsert = Database['public']['Tables']['customer_notification_logs']['Insert']

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function POST(request: Request, { params }: RouteParams) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { followup_id: followupId } = await params
  const { supabase, storeId, user } = allowed
  const taskCheck = await assertFollowupTaskInStore({ supabase, storeId, followupId })
  if ('error' in taskCheck) return taskCheck.error

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asJsonObjectOrNull(bodyRaw)

  const eventType = toOptionalString(body?.event_type)
  if (!eventType || !FOLLOWUP_EVENT_TYPES.has(eventType)) {
    return jsonError('有効な event_type を指定してください。', 400)
  }

  const payloadValue = body?.payload
  const payloadRecord = asJsonObject(payloadValue)

  if (
    (eventType === 'contacted_phone' || eventType === 'contacted_line') &&
    isResolvedStatus(taskCheck.data.status)
  ) {
    return jsonError('解決済みタスクには連絡記録を追加できません。', 400)
  }

  if (eventType === 'contacted_phone' || eventType === 'contacted_line') {
    const channel = eventType === 'contacted_phone' ? 'phone' : 'line'

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, phone_number, line_id')
      .eq('id', taskCheck.data.customer_id)
      .eq('store_id', storeId)
      .maybeSingle()

    if (customerError) {
      return jsonError(customerError.message, 500)
    }
    if (!customer) {
      return jsonError('顧客情報が見つかりません。', 404)
    }

    const fallbackTarget = channel === 'phone' ? customer.phone_number : customer.line_id
    if (!fallbackTarget) {
      return jsonError(
        channel === 'phone' ? '電話番号が未登録です。' : 'LINE IDが未登録です。',
        400
      )
    }

    if (eventType === 'contacted_line') {
      const bodyText = toOptionalString(payloadRecord.body)
      if (!bodyText) {
        return jsonError('LINE連絡記録では payload.body が必須です。', 400)
      }
    }

    const result = toOptionalString(payloadRecord.result)
    if (eventType === 'contacted_phone' && result && !['connected', 'voicemail', 'no_answer'].includes(result)) {
      return jsonError('電話連絡の result は connected/voicemail/no_answer のみ指定できます。', 400)
    }

    const target =
      typeof payloadRecord.target === 'string'
        ? payloadRecord.target
        : typeof payloadRecord.line_id === 'string'
          ? payloadRecord.line_id
          : typeof payloadRecord.phone_number === 'string'
            ? payloadRecord.phone_number
            : fallbackTarget
    const dedupeKey = [
      'followup',
      followupId,
      channel,
      new Date().toISOString().slice(0, 10),
    ].join(':')
    const { data: existingNotification } = await supabase
      .from('customer_notification_logs')
      .select('id')
      .eq('store_id', storeId)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()

    if (existingNotification) {
      const duplicateNotification: NotificationLogInsert = {
        store_id: storeId,
        customer_id: taskCheck.data.customer_id,
        actor_user_id: user.id,
        channel,
        notification_type:
          typeof payloadRecord.notification_type === 'string' ? payloadRecord.notification_type : 'followup',
        status: 'canceled',
        subject: typeof payloadRecord.subject === 'string' ? payloadRecord.subject : null,
        body: typeof payloadRecord.body === 'string' ? payloadRecord.body : null,
        target,
        dedupe_key: `${dedupeKey}:skipped`,
        payload: toJson({
          ...payloadRecord,
          reason: 'dedupe',
        }),
        sent_at: new Date().toISOString(),
      }
      await supabase.from('customer_notification_logs').insert(duplicateNotification)
      return jsonError('同一フォローアップへの同日同チャネル送信は既に記録済みです。', 409)
    }

    const notificationLog: NotificationLogInsert = {
      store_id: storeId,
      customer_id: taskCheck.data.customer_id,
      actor_user_id: user.id,
      channel,
      notification_type:
        typeof payloadRecord.notification_type === 'string' ? payloadRecord.notification_type : 'followup',
      status: 'sent',
      subject: typeof payloadRecord.subject === 'string' ? payloadRecord.subject : null,
      body: typeof payloadRecord.body === 'string' ? payloadRecord.body : null,
      target,
      dedupe_key: dedupeKey,
      payload: toJson(payloadRecord),
      sent_at: new Date().toISOString(),
    }
    await supabase.from('customer_notification_logs').insert(notificationLog)

    const taskUpdate: FollowupTaskUpdate = {
      last_contacted_at: new Date().toISOString(),
      last_contact_method: eventType === 'contacted_phone' ? 'phone' : 'line',
      updated_at: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('customer_followup_tasks')
      .update(taskUpdate)
      .eq('id', followupId)
      .eq('store_id', storeId)

    if (updateError) {
      return jsonError(updateError.message, 500)
    }
  }

  const followupEvent: FollowupEventInsert = {
    store_id: storeId,
    task_id: followupId,
    actor_user_id: user.id,
    event_type: eventType,
    payload: toJson(payloadRecord),
  }

  const { data, error } = await supabase
    .from('customer_followup_events')
    .insert(followupEvent)
    .select('id, event_type, payload, created_at')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ event: data }, { status: 201 })
}
