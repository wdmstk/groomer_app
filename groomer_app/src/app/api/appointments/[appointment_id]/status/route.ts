import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

const statusTransitionMap: Record<string, string> = {
  予約済: '受付',
  受付: '施術中',
  施術中: '会計待ち',
  会計待ち: '完了',
}

const statusTimestampColumnMap: Record<string, 'checked_in_at' | 'in_service_at' | 'payment_waiting_at' | 'completed_at'> =
  {
    受付: 'checked_in_at',
    施術中: 'in_service_at',
    会計待ち: 'payment_waiting_at',
    完了: 'completed_at',
  }

function normalizeStatus(status: string | null | undefined) {
  if (status === '来店済') return '完了'
  return status ?? '予約済'
}

function resolveRedirectPath(tab: string | null) {
  if (tab === 'calendar') return '/appointments?tab=calendar'
  return '/appointments?tab=list'
}

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function POST(request: Request, { params }: RouteParams) {
  const formData = await request.formData()
  const nextStatus = formData.get('next_status')?.toString() ?? ''
  const redirectTab = formData.get('redirect_tab')?.toString() ?? null
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
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
  const expectedNext = statusTransitionMap[currentStatus]
  if (!expectedNext || nextStatus !== expectedNext) {
    return NextResponse.json({ message: '不正なステータス遷移です。' }, { status: 400 })
  }

  const timestampColumn = statusTimestampColumnMap[nextStatus]
  const nowIso = new Date().toISOString()
  const nextTimestamp =
    (appointment[timestampColumn as keyof typeof appointment] as string | null) ?? nowIso
  const updatePayload = {
    status: nextStatus,
    [timestampColumn]: nextTimestamp,
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
    action: 'status_changed',
    before: appointment,
    after: {
      ...appointment,
      ...updatePayload,
    },
    payload: {
      from_status: currentStatus,
      to_status: nextStatus,
      timestamp_column: timestampColumn,
    },
  })

  return NextResponse.redirect(new URL(redirectTo ?? resolveRedirectPath(redirectTab), request.url))
}
