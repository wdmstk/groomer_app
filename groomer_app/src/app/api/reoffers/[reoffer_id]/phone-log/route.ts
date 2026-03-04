import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function POST(
  request: Request,
  context: { params: Promise<{ reoffer_id: string }> }
) {
  const { reoffer_id } = await context.params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = (await request.json().catch(() => null)) as
    | {
        result?: string
        note?: string
      }
    | null

  const result =
    body?.result === 'connected' || body?.result === 'voicemail' || body?.result === 'no_answer'
      ? body.result
      : ''
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

  if (!result) {
    return NextResponse.json({ message: 'result が不正です。' }, { status: 400 })
  }

  const { data: reoffer, error: reofferError } = await supabase
    .from('slot_reoffers')
    .select('id, appointment_id, target_customer_id, target_pet_id, target_staff_id')
    .eq('id', reoffer_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (reofferError) {
    return NextResponse.json({ message: reofferError.message }, { status: 500 })
  }
  if (!reoffer) {
    return NextResponse.json({ message: '再販レコードが見つかりません。' }, { status: 404 })
  }

  const { data: customer } = reoffer.target_customer_id
    ? await supabase
        .from('customers')
        .select('phone_number')
        .eq('id', reoffer.target_customer_id)
        .eq('store_id', storeId)
        .maybeSingle()
    : { data: null }

  const nowIso = new Date().toISOString()
  const { error: notificationError } = await supabase.from('customer_notification_logs').insert({
    store_id: storeId,
    customer_id: reoffer.target_customer_id,
    appointment_id: reoffer.appointment_id,
    slot_reoffer_id: reoffer_id,
    actor_user_id: user?.id ?? null,
    channel: 'phone',
    notification_type: 'slot_reoffer',
    status: 'sent',
    subject: 'キャンセル枠の電話連絡',
    body: note,
    target: customer?.phone_number ?? null,
    payload: {
      result,
      note,
      target_customer_id: reoffer.target_customer_id,
      target_pet_id: reoffer.target_pet_id,
      target_staff_id: reoffer.target_staff_id,
      target: customer?.phone_number ?? null,
    },
    sent_at: nowIso,
  })

  if (notificationError) {
    return NextResponse.json({ message: notificationError.message }, { status: 500 })
  }

  const { error: logError } = await supabase.from('slot_reoffer_logs').insert({
    store_id: storeId,
    slot_reoffer_id: reoffer_id,
    appointment_id: reoffer.appointment_id,
    actor_user_id: user?.id ?? null,
    event_type: 'sent',
    payload: {
      channel: 'phone',
      result,
      note,
      target_customer_id: reoffer.target_customer_id,
      target_pet_id: reoffer.target_pet_id,
      target_staff_id: reoffer.target_staff_id,
    },
  })

  if (logError) {
    return NextResponse.json({ message: logError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
