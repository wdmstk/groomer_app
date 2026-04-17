import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import { isAttendanceMonthClosed, monthKeyFromDateKey } from '@/lib/attendance/monthly-closing'

function toDateKeyJst(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export async function GET(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const url = new URL(request.url)
  const status = (url.searchParams.get('status') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''

  let query = auth.supabase
    .from('attendance_adjustment_requests')
    .select('id, staff_id, business_date, requested_payload, reason, status, reviewed_by_user_id, reviewed_at, created_at')
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: false })

  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    query = query.eq('status', status)
  }
  if (auth.role === 'staff') {
    query = query.eq('staff_id', ownStaffId || '__none__')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: { requests: data ?? [] } })
}

export async function POST(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })

  const contentType = request.headers.get('content-type') ?? ''
  let body: UnknownObject = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    body = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    const requestedEventType = formData.get('requested_event_type')?.toString() ?? ''
    const requestedOccurredAt = formData.get('requested_occurred_at')?.toString() ?? ''
    const requestedOccurredAtDate = new Date(requestedOccurredAt)
    const requestedOccurredAtIso = Number.isFinite(requestedOccurredAtDate.getTime())
      ? requestedOccurredAtDate.toISOString()
      : ''
    const requestedPayload =
      requestedEventType && requestedOccurredAtIso
        ? {
            events: [
              {
                event_type: requestedEventType,
                occurred_at: requestedOccurredAtIso,
              },
            ],
          }
        : {}
    body = {
      staff_id: formData.get('staff_id')?.toString() ?? '',
      reason: formData.get('reason')?.toString() ?? '',
      business_date: formData.get('business_date')?.toString() ?? '',
      requested_payload: requestedPayload,
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const requestedStaffId = String(body.staff_id ?? '').trim()
  const reason = String(body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ message: 'reason は必須です。' }, { status: 400 })

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? null
  const staffId = requestedStaffId || ownStaffId
  if (!staffId) return NextResponse.json({ message: 'staff_id を指定してください。' }, { status: 400 })

  if (auth.role === 'staff' && staffId !== ownStaffId) {
    return NextResponse.json({ message: '他スタッフの修正申請はできません。' }, { status: 403 })
  }

  const businessDateRaw = String(body.business_date ?? '').trim()
  const businessDate =
    /^\d{4}-\d{2}-\d{2}$/.test(businessDateRaw) ? businessDateRaw : toDateKeyJst(new Date().toISOString())
  const monthKey = monthKeyFromDateKey(businessDate)
  const monthClosing = await isAttendanceMonthClosed({ db: auth.supabase, storeId: auth.storeId, targetMonth: monthKey })
  if (monthClosing.message) return NextResponse.json({ message: monthClosing.message }, { status: 500 })
  if (monthClosing.closed) {
    return NextResponse.json({ message: '対象月は勤怠確定済みのため、修正申請を作成できません。' }, { status: 409 })
  }

  const requestedPayload = asObject(body.requested_payload)
  const { error } = await auth.supabase.from('attendance_adjustment_requests').insert({
    store_id: auth.storeId,
    staff_id: staffId,
    business_date: businessDate,
    requested_payload: requestedPayload,
    reason,
    status: 'pending',
  })
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true }, { status: 201 })
}
