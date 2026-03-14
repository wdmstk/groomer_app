import { NextResponse } from 'next/server'
import type { Message } from '@line/bot-sdk'
import { sendLineMessage } from '@/lib/line'
import {
  getDefaultSlotReofferLineTemplate,
  renderSlotReofferLineTemplate,
} from '@/lib/reoffers/templates'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asObjectOrNull } from '@/lib/object-utils'

function dedupeKeyForReoffer(params: {
  appointmentId: string
  customerId: string
  channel: string
  dateKey: string
}) {
  return ['slot_reoffer', params.appointmentId, params.customerId, params.channel, params.dateKey].join(':')
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ reoffer_id: string }> }
) {
  const { reoffer_id } = await context.params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: reoffer, error: reofferError } = await supabase
    .from('slot_reoffers')
    .select(
      'id, appointment_id, target_customer_id, target_pet_id, target_staff_id, status, notes'
    )
    .eq('id', reoffer_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (reofferError) {
    return NextResponse.json({ message: reofferError.message }, { status: 500 })
  }
  if (!reoffer) {
    return NextResponse.json({ message: '再販レコードが見つかりません。' }, { status: 404 })
  }
  if (reoffer.status !== 'draft') {
    return NextResponse.json({ message: 'draft のみ承認送信できます。' }, { status: 400 })
  }
  if (!reoffer.target_customer_id) {
    return NextResponse.json({ message: 'target_customer_id が未設定です。' }, { status: 400 })
  }

  const { data: draftedLog } = await supabase
    .from('slot_reoffer_logs')
    .select('payload')
    .eq('store_id', storeId)
    .eq('slot_reoffer_id', reoffer.id)
    .eq('event_type', 'candidate_selected')
    .contains('payload', { phase: 'drafted' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const draftedPayloadRaw = draftedLog?.payload
  const draftedPayload = asObjectOrNull(draftedPayloadRaw) ?? {}
  const channel =
    draftedPayload.channel === 'line' || draftedPayload.channel === 'phone' || draftedPayload.channel === 'manual'
      ? draftedPayload.channel
      : 'manual'
  const subject =
    typeof draftedPayload.subject === 'string' && draftedPayload.subject.trim()
      ? draftedPayload.subject.trim()
      : 'キャンセル枠のご案内'
  const notes =
    typeof draftedPayload.notes === 'string'
      ? draftedPayload.notes.trim()
      : typeof reoffer.notes === 'string'
        ? reoffer.notes.trim()
        : null

  const [{ data: appointment }, { data: customer }, { data: pet }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, start_time, end_time, menu')
      .eq('id', reoffer.appointment_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select('id, full_name, line_id, phone_number')
      .eq('id', reoffer.target_customer_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    reoffer.target_pet_id
      ? supabase
          .from('pets')
          .select('id, name')
          .eq('id', reoffer.target_pet_id)
          .eq('store_id', storeId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (!appointment || !customer) {
    return NextResponse.json({ message: '再販対象の予約または顧客が見つかりません。' }, { status: 404 })
  }

  const sentAt = new Date().toISOString()
  const dedupeKey = dedupeKeyForReoffer({
    appointmentId: reoffer.appointment_id,
    customerId: reoffer.target_customer_id,
    channel,
    dateKey: sentAt.slice(0, 10),
  })

  const notificationTarget =
    channel === 'line' ? customer.line_id : channel === 'phone' ? customer.phone_number : null
  const { data: existingNotification } = await supabase
    .from('customer_notification_logs')
    .select('id')
    .eq('store_id', storeId)
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()

  if (existingNotification) {
    return NextResponse.json({ message: '同一顧客への再販送信記録は本日分が既にあります。' }, { status: 409 })
  }

  let templateBody: string | null = null
  const { data: templateRow, error: templateError } = await supabase
    .from('notification_templates')
    .select('body')
    .eq('store_id', storeId)
    .eq('template_key', 'slot_reoffer_line')
    .eq('channel', 'line')
    .eq('is_active', true)
    .maybeSingle()
  if (!templateError) {
    templateBody = typeof templateRow?.body === 'string' ? templateRow.body : null
  } else if (!templateError.message.includes('notification_templates')) {
    return NextResponse.json({ message: templateError.message }, { status: 500 })
  }

  let notificationStatus: 'sent' | 'failed' = 'sent'
  let notificationBody = notes
  if (channel === 'line') {
    if (!customer.line_id) {
      return NextResponse.json({ message: 'LINE送信先が未登録です。' }, { status: 400 })
    }
    const lineText = renderSlotReofferLineTemplate({
      customerName: customer.full_name,
      menu: appointment.menu,
      petName: pet?.name ?? null,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      note: notes,
      templateBody: templateBody ?? getDefaultSlotReofferLineTemplate(),
    })
    const messages: Message[] = [{ type: 'text', text: lineText }]
    const sendResult = await sendLineMessage({ to: customer.line_id, messages })
    notificationStatus = sendResult.success ? 'sent' : 'failed'
    notificationBody = lineText
  }

  const { data: updated, error: updateError } = await supabase
    .from('slot_reoffers')
    .update({
      status: 'sent',
      sent_at: sentAt,
      notes,
    })
    .eq('id', reoffer_id)
    .eq('store_id', storeId)
    .select('id, appointment_id, target_customer_id, status, sent_at, accepted_at')
    .single()

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  const { error: notificationError } = await supabase.from('customer_notification_logs').insert({
    store_id: storeId,
    customer_id: reoffer.target_customer_id,
    appointment_id: reoffer.appointment_id,
    slot_reoffer_id: reoffer.id,
    actor_user_id: user?.id ?? null,
    channel,
    notification_type: 'slot_reoffer',
    status: notificationStatus,
    subject,
    body: notificationBody,
    target: notificationTarget,
    dedupe_key: dedupeKey,
    payload: {
      target_customer_id: reoffer.target_customer_id,
      target_pet_id: reoffer.target_pet_id,
      target_staff_id: reoffer.target_staff_id,
      target: notificationTarget,
      subject,
      notes,
      notification_status: notificationStatus,
      approved_by: user?.id ?? null,
    },
    sent_at: sentAt,
  })
  if (notificationError) {
    return NextResponse.json({ message: notificationError.message }, { status: 500 })
  }

  const { error: logError } = await supabase.from('slot_reoffer_logs').insert({
    store_id: storeId,
    slot_reoffer_id: reoffer.id,
    appointment_id: reoffer.appointment_id,
    actor_user_id: user?.id ?? null,
    event_type: 'sent',
    payload: {
      target_customer_id: reoffer.target_customer_id,
      target_pet_id: reoffer.target_pet_id,
      target_staff_id: reoffer.target_staff_id,
      channel,
      subject,
      notes,
      notification_status: notificationStatus,
      approved_by: user?.id ?? null,
    },
  })
  if (logError) {
    return NextResponse.json({ message: logError.message }, { status: 500 })
  }

  return NextResponse.json({ reoffer: updated })
}
