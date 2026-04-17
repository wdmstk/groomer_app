import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import { isAttendanceMonthClosed, monthKeyFromDateKey } from '@/lib/attendance/monthly-closing'

type LeaveRequestType = 'paid_leave' | 'half_leave_am' | 'half_leave_pm' | 'special_leave' | 'absence'

function parseRequestType(value: string): LeaveRequestType | null {
  if (
    value === 'paid_leave' ||
    value === 'half_leave_am' ||
    value === 'half_leave_pm' ||
    value === 'special_leave' ||
    value === 'absence'
  ) {
    return value
  }
  return null
}

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
  const requestedStaffId = (url.searchParams.get('staff_id') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = auth.role === 'staff' ? ownStaffId : requestedStaffId

  let query = auth.supabase
    .from('attendance_leave_requests')
    .select('id, staff_id, target_date, request_type, reason, requested_payload, status, reviewed_by_user_id, reviewed_at, created_at')
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: false })

  if (status === 'pending' || status === 'approved' || status === 'rejected' || status === 'returned') {
    query = query.eq('status', status)
  }
  if (targetStaffId) {
    query = query.eq('staff_id', targetStaffId)
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
    body = {
      staff_id: formData.get('staff_id')?.toString() ?? '',
      target_date: formData.get('target_date')?.toString() ?? '',
      request_type: formData.get('request_type')?.toString() ?? '',
      reason: formData.get('reason')?.toString() ?? '',
      requested_payload: {},
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const requestType = parseRequestType(String(body.request_type ?? '').trim())
  if (!requestType) return NextResponse.json({ message: 'request_type が不正です。' }, { status: 400 })
  const reason = String(body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ message: 'reason は必須です。' }, { status: 400 })

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''

  const requestedStaffId = String(body.staff_id ?? '').trim()
  const staffId = requestedStaffId || ownStaffId
  if (!staffId) return NextResponse.json({ message: 'staff_id を指定してください。' }, { status: 400 })
  if (auth.role === 'staff' && staffId !== ownStaffId) {
    return NextResponse.json({ message: '他スタッフの休暇申請はできません。' }, { status: 403 })
  }

  const targetDateRaw = String(body.target_date ?? '').trim()
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDateRaw) ? targetDateRaw : toDateKeyJst(new Date().toISOString())
  const monthKey = monthKeyFromDateKey(targetDate)
  const monthClosing = await isAttendanceMonthClosed({ db: auth.supabase, storeId: auth.storeId, targetMonth: monthKey })
  if (monthClosing.message) return NextResponse.json({ message: monthClosing.message }, { status: 500 })
  if (monthClosing.closed) {
    return NextResponse.json({ message: '対象月は勤怠確定済みのため、休暇申請を作成できません。' }, { status: 409 })
  }
  const requestedPayload = asObject(body.requested_payload)

  const { error } = await auth.supabase.from('attendance_leave_requests').insert({
    store_id: auth.storeId,
    staff_id: staffId,
    target_date: targetDate,
    request_type: requestType,
    reason,
    requested_payload: requestedPayload,
    status: 'pending',
  })
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: '同日の未処理申請が存在します。' }, { status: 409 })
    }
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true }, { status: 201 })
}
