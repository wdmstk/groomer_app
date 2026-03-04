import { NextResponse } from 'next/server'
import {
  assertFollowupTaskInStore,
  FOLLOWUP_EVENT_TYPES,
  getFollowupRouteContext,
  jsonError,
  toOptionalString,
} from '@/lib/followups/shared'

type RouteParams = {
  params: Promise<{
    followup_id: string
  }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { followup_id: followupId } = await params
  const { supabase, storeId, user } = allowed
  const taskCheck = await assertFollowupTaskInStore({ supabase, storeId, followupId })
  if ('error' in taskCheck) return taskCheck.error

  const body = (await request.json().catch(() => null)) as
    | {
        event_type?: string
        payload?: Record<string, unknown>
      }
    | null

  const eventType = toOptionalString(body?.event_type)
  if (!eventType || !FOLLOWUP_EVENT_TYPES.has(eventType)) {
    return jsonError('有効な event_type を指定してください。', 400)
  }

  const payload = typeof body?.payload === 'object' && body.payload ? body.payload : {}
  const { data, error } = await supabase
    .from('customer_followup_events')
    .insert({
      store_id: storeId,
      task_id: followupId,
      actor_user_id: user.id,
      event_type: eventType,
      payload,
    })
    .select('id, event_type, payload, created_at')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  if (eventType === 'contacted_phone' || eventType === 'contacted_line') {
    const channel = eventType === 'contacted_phone' ? 'phone' : 'line'
    const target =
      typeof payload.target === 'string'
        ? payload.target
        : typeof payload.line_id === 'string'
          ? payload.line_id
          : typeof payload.phone_number === 'string'
            ? payload.phone_number
            : null
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
      await supabase.from('customer_notification_logs').insert({
        store_id: storeId,
        customer_id: taskCheck.data.customer_id,
        actor_user_id: user.id,
        channel,
        notification_type:
          typeof payload.notification_type === 'string' ? payload.notification_type : 'followup',
        status: 'canceled',
        subject: typeof payload.subject === 'string' ? payload.subject : null,
        body: typeof payload.body === 'string' ? payload.body : null,
        target,
        dedupe_key: `${dedupeKey}:skipped`,
        payload: {
          ...payload,
          reason: 'dedupe',
        },
        sent_at: new Date().toISOString(),
      })
      return jsonError('同一フォローアップへの同日同チャネル送信は既に記録済みです。', 409)
    }

    await supabase.from('customer_notification_logs').insert({
      store_id: storeId,
      customer_id: taskCheck.data.customer_id,
      actor_user_id: user.id,
      channel,
      notification_type:
        typeof payload.notification_type === 'string' ? payload.notification_type : 'followup',
      status: 'sent',
      subject: typeof payload.subject === 'string' ? payload.subject : null,
      body: typeof payload.body === 'string' ? payload.body : null,
      target,
      dedupe_key: dedupeKey,
      payload,
      sent_at: new Date().toISOString(),
    })

    const { error: updateError } = await supabase
      .from('customer_followup_tasks')
      .update({
        last_contacted_at: new Date().toISOString(),
        last_contact_method: eventType === 'contacted_phone' ? 'phone' : 'line',
        updated_at: new Date().toISOString(),
      })
      .eq('id', followupId)
      .eq('store_id', storeId)

    if (updateError) {
      return jsonError(updateError.message, 500)
    }
  }

  return NextResponse.json({ event: data }, { status: 201 })
}
