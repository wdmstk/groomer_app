import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import { isAttendanceMonthClosed, monthKeyFromDateKey } from '@/lib/attendance/monthly-closing'

type RouteContext = {
  params: Promise<{
    request_id: string
  }>
}

function parseDecision(value: string) {
  if (value === 'approve' || value === 'reject' || value === 'return') return value
  return null
}

function leaveFlagByType(requestType: string) {
  if (requestType === 'paid_leave') return { paid_leave: true }
  if (requestType === 'half_leave_am') return { half_leave_am: true }
  if (requestType === 'half_leave_pm') return { half_leave_pm: true }
  if (requestType === 'special_leave') return { special_leave: true }
  if (requestType === 'absence') return { absence: true }
  return {}
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStoreMembership(['owner', 'admin'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const { request_id: requestId } = await context.params

  const contentType = request.headers.get('content-type') ?? ''
  let body: UnknownObject = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    body = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    body = { decision: formData.get('decision')?.toString() ?? '' }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }
  const decision = parseDecision(String(body.decision ?? '').trim())
  if (!decision) return NextResponse.json({ message: 'decision は approve/reject/return を指定してください。' }, { status: 400 })

  const { data: requestRow, error: requestError } = await auth.supabase
    .from('attendance_leave_requests')
    .select('id, store_id, staff_id, target_date, request_type, status')
    .eq('id', requestId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (requestError) return NextResponse.json({ message: requestError.message }, { status: 500 })
  if (!requestRow) return NextResponse.json({ message: '申請が見つかりません。' }, { status: 404 })
  if (requestRow.status !== 'pending') {
    return NextResponse.json({ message: 'この申請はすでに処理済みです。' }, { status: 409 })
  }
  const monthKey = monthKeyFromDateKey(requestRow.target_date)
  const monthClosing = await isAttendanceMonthClosed({ db: auth.supabase, storeId: auth.storeId, targetMonth: monthKey })
  if (monthClosing.message) return NextResponse.json({ message: monthClosing.message }, { status: 500 })
  if (monthClosing.closed) {
    return NextResponse.json({ message: '対象月は勤怠確定済みのため、申請を処理できません。' }, { status: 409 })
  }

  const nextStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'returned'
  const { error: updateError } = await auth.supabase
    .from('attendance_leave_requests')
    .update({
      status: nextStatus,
      reviewed_by_user_id: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('store_id', auth.storeId)
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 })

  if (decision === 'approve') {
    const { data: currentSummary } = await auth.supabase
      .from('attendance_daily_summaries')
      .select('flags')
      .eq('store_id', auth.storeId)
      .eq('staff_id', requestRow.staff_id)
      .eq('business_date', requestRow.target_date)
      .maybeSingle()
    const mergedFlags = {
      ...(currentSummary?.flags && typeof currentSummary.flags === 'object' ? currentSummary.flags : {}),
      ...leaveFlagByType(requestRow.request_type),
    }
    await auth.supabase.from('attendance_daily_summaries').upsert(
      {
        store_id: auth.storeId,
        staff_id: requestRow.staff_id,
        business_date: requestRow.target_date,
        status: 'complete',
        worked_minutes: 0,
        break_minutes: 0,
        flags: mergedFlags,
      },
      { onConflict: 'store_id,staff_id,business_date' }
    )

    if (requestRow.request_type === 'paid_leave') {
      const { data: balance } = await auth.supabase
        .from('staff_leave_balances')
        .select('id, used_days, remaining_days')
        .eq('store_id', auth.storeId)
        .eq('staff_id', requestRow.staff_id)
        .eq('leave_type', 'paid_leave')
        .lte('effective_from', requestRow.target_date)
        .gte('effective_to', requestRow.target_date)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (balance) {
        await auth.supabase
          .from('staff_leave_balances')
          .update({
            used_days: Number(balance.used_days ?? 0) + 1,
            remaining_days: Math.max(0, Number(balance.remaining_days ?? 0) - 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', balance.id)
      }
    }
  }

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true, data: { decision: nextStatus } })
}
