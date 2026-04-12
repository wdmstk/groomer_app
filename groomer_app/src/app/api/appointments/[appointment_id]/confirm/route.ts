import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
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

  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select(
      'id, status, customer_id, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at'
    )
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (fetchError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  if (appointment.status !== '予約申請') {
    return NextResponse.json({ message: '予約申請ステータスではありません。' }, { status: 400 })
  }

  const method = normalizeReservationPaymentMethod(appointment.reservation_payment_method)
  const paymentStatus = normalizeReservationPaymentStatus(appointment.reservation_payment_status)
  const nowIso = new Date().toISOString()
  const paymentUpdate =
    method === 'card_hold' && paymentStatus === 'authorized'
      ? {
          reservation_payment_status: 'captured',
          reservation_payment_paid_at: appointment.reservation_payment_paid_at ?? nowIso,
          reservation_payment_authorized_at: appointment.reservation_payment_authorized_at ?? nowIso,
        }
      : method === 'card_hold'
        ? {
            reservation_payment_status: 'charge_pending',
          }
        : {}
  const updatePayload = {
    status: '予約済',
    ...paymentUpdate,
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
    action: 'confirmed',
    before: appointment,
    after: {
      ...appointment,
      ...updatePayload,
    },
    payload: {
      from_status: appointment.status,
      to_status: '予約済',
      reservation_payment_method: method,
      reservation_payment_status_from: paymentStatus,
      reservation_payment_status_to:
        'reservation_payment_status' in paymentUpdate
          ? paymentUpdate.reservation_payment_status
          : paymentStatus,
    },
  })

  // TODO: Integrate notification delivery (email/SMS/LINE) on confirmation.
  return NextResponse.redirect(new URL(redirectTo ?? '/appointments?tab=list', request.url), { status: 303 })
}
