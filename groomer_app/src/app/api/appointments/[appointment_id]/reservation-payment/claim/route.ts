import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
  DEFAULT_RESERVATION_PAYMENT_SETTINGS,
  normalizeReservationPaymentMethod,
  normalizeReservationPaymentStatus,
} from '@/lib/appointments/reservation-payment'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function POST(request: Request, { params }: RouteParams) {
  const { appointment_id: appointmentId } = await params
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: appointment, error: appointmentError }, { data: settingsRow }] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, status, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at'
      )
      .eq('id', appointmentId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('store_reservation_payment_settings')
      .select('cancellation_no_show_percent, no_show_charge_mode')
      .eq('store_id', storeId)
      .maybeSingle(),
  ])

  if (appointmentError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  if (appointment.status !== '無断キャンセル') {
    return NextResponse.json({ message: '無断キャンセルの予約のみ請求できます。' }, { status: 400 })
  }

  const method = normalizeReservationPaymentMethod(appointment.reservation_payment_method)
  const currentStatus = normalizeReservationPaymentStatus(appointment.reservation_payment_status)
  if (method !== 'prepayment' && method !== 'card_hold') {
    return NextResponse.json({ message: '事前決済または仮押さえ設定の予約ではありません。' }, { status: 400 })
  }

  const settings = {
    ...DEFAULT_RESERVATION_PAYMENT_SETTINGS,
    cancellation_no_show_percent: settingsRow?.cancellation_no_show_percent ?? DEFAULT_RESERVATION_PAYMENT_SETTINGS.cancellation_no_show_percent,
    no_show_charge_mode: settingsRow?.no_show_charge_mode ?? DEFAULT_RESERVATION_PAYMENT_SETTINGS.no_show_charge_mode,
  }

  const nowIso = new Date().toISOString()
  const updatePayload =
    method === 'card_hold' && currentStatus === 'authorized'
      ? {
          reservation_payment_status: 'captured',
          reservation_payment_paid_at: nowIso,
        }
      : method === 'prepayment' && (currentStatus === 'paid' || currentStatus === 'captured')
        ? {
            reservation_payment_status: 'paid',
            reservation_payment_paid_at: appointment.reservation_payment_paid_at ?? nowIso,
          }
        : {
            reservation_payment_status: 'charge_pending',
          }

  const { error: updateError } = await supabase
    .from('appointments')
    .update(updatePayload)
    .eq('id', appointmentId)
    .eq('store_id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'appointment',
    entityId: appointmentId,
    action: 'reservation_payment_claimed',
    before: appointment,
    after: {
      ...appointment,
      ...updatePayload,
    },
    payload: {
      charge_percent: settings.cancellation_no_show_percent,
      mode: settings.no_show_charge_mode,
    },
  })

  return NextResponse.redirect(new URL(redirectTo ?? '/appointments?tab=list', request.url))
}
