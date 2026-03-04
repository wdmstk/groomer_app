import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
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
    .select('id, status, customer_id')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (fetchError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  if (appointment.status !== '予約申請') {
    return NextResponse.json({ message: '予約申請ステータスではありません。' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: '予約済' })
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
      status: '予約済',
    },
    payload: {
      from_status: appointment.status,
      to_status: '予約済',
    },
  })

  // TODO: Integrate notification delivery (email/SMS/LINE) on confirmation.
  return NextResponse.redirect(new URL(redirectTo ?? '/appointments?tab=list', request.url))
}
