import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

function normalizeStatus(status: string | null | undefined) {
  if (status === '来店済') return '完了'
  return status ?? '予約済'
}

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function POST(request: Request, { params }: RouteParams) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const reason = (formData.get('reason')?.toString() ?? '').trim() || 'operator_revert'
  const { appointment_id: appointmentId } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, checked_in_at, in_service_at, payment_waiting_at, completed_at')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (fetchError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  const currentStatus = normalizeStatus(appointment.status)
  if (currentStatus === '会計待ち') {
    return NextResponse.redirect(new URL(redirectTo ?? '/ops/today', request.url))
  }
  if (currentStatus !== '完了') {
    return NextResponse.json({ message: 'このステータスは差し戻しできません。' }, { status: 400 })
  }

  const nextStatus = '会計待ち'
  const updatePayload = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
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
    action: 'status_reverted',
    before: appointment,
    after: {
      ...appointment,
      ...updatePayload,
    },
    payload: {
      from_status: currentStatus,
      to_status: nextStatus,
      reason,
    },
  })

  return NextResponse.redirect(new URL(redirectTo ?? '/ops/today', request.url))
}
