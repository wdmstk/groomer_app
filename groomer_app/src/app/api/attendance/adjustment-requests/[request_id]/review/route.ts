import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, asObjectOrNull } from '@/lib/object-utils'
import { recomputeAttendanceDailySummary } from '@/lib/staff-shifts/attendance'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import { isAttendanceMonthClosed, monthKeyFromDateKey } from '@/lib/attendance/monthly-closing'

type RouteContext = {
  params: Promise<{
    request_id: string
  }>
}

type EventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

function parseEventType(value: string): EventType | null {
  if (value === 'clock_in' || value === 'clock_out' || value === 'break_start' || value === 'break_end') return value
  return null
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStoreMembership(['owner', 'admin'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const { request_id: requestId } = await context.params
  const contentType = request.headers.get('content-type') ?? ''
  let body: { [key: string]: unknown } = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    body = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    body = {
      decision: formData.get('decision')?.toString() ?? '',
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }
  const decision = String(body.decision ?? '').trim()
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ message: 'decision は approve/reject を指定してください。' }, { status: 400 })
  }

  const { data: requestRow, error: requestError } = await auth.supabase
    .from('attendance_adjustment_requests')
    .select('id, store_id, staff_id, business_date, requested_payload, status')
    .eq('id', requestId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (requestError) return NextResponse.json({ message: requestError.message }, { status: 500 })
  if (!requestRow) return NextResponse.json({ message: '申請が見つかりません。' }, { status: 404 })
  if (requestRow.status !== 'pending') {
    return NextResponse.json({ message: 'この申請はすでに処理済みです。' }, { status: 409 })
  }
  const monthKey = monthKeyFromDateKey(requestRow.business_date)
  const monthClosing = await isAttendanceMonthClosed({ db: auth.supabase, storeId: auth.storeId, targetMonth: monthKey })
  if (monthClosing.message) return NextResponse.json({ message: monthClosing.message }, { status: 500 })
  if (monthClosing.closed) {
    return NextResponse.json({ message: '対象月は勤怠確定済みのため、申請を処理できません。' }, { status: 409 })
  }

  if (decision === 'reject') {
    const { error: updateError } = await auth.supabase
      .from('attendance_adjustment_requests')
      .update({
        status: 'rejected',
        reviewed_by_user_id: auth.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('store_id', auth.storeId)
    if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 })
    if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
    return NextResponse.json({ ok: true, data: { decision: 'rejected' } })
  }

  const payload = asObjectOrNull(requestRow.requested_payload) ?? {}
  const eventsValue = Array.isArray(payload.events) ? payload.events : []
  const events = eventsValue
    .map((row) => asObjectOrNull(row))
    .filter((row): row is { [key: string]: unknown } => Boolean(row))
    .map((row) => ({
      eventType: parseEventType(String(row.event_type ?? '')),
      occurredAt: String(row.occurred_at ?? ''),
    }))
    .filter((row) => Boolean(row.eventType) && Number.isFinite(new Date(row.occurredAt).getTime()))

  if (events.length === 0) {
    return NextResponse.json({ message: '承認対象イベントがありません。' }, { status: 400 })
  }

  const { error: insertError } = await auth.supabase.from('attendance_events').insert(
    events.map((event) => ({
      store_id: auth.storeId,
      staff_id: requestRow.staff_id,
      business_date: requestRow.business_date,
      event_type: event.eventType as EventType,
      occurred_at: event.occurredAt,
      source_type: 'approved_request',
    }))
  )
  if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 })

  const { error: updateError } = await auth.supabase
    .from('attendance_adjustment_requests')
    .update({
      status: 'approved',
      reviewed_by_user_id: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('store_id', auth.storeId)
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 })

  const summary = await recomputeAttendanceDailySummary({
    db: auth.supabase,
    storeId: auth.storeId,
    staffId: requestRow.staff_id,
    businessDate: requestRow.business_date,
  })

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true, data: { decision: 'approved', summary } })
}
