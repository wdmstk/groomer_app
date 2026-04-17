import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'

function parseDate(value: string | null) {
  const candidate = (value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null
}

function todayJst() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function GET(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const url = new URL(request.url)
  const from = parseDate(url.searchParams.get('from')) ?? todayJst()
  const to = parseDate(url.searchParams.get('to')) ?? from
  const requestedStaffId = (url.searchParams.get('staff_id') ?? '').trim()
  const resolvedOnly = (url.searchParams.get('resolved') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = auth.role === 'staff' ? ownStaffId : requestedStaffId

  let query = auth.supabase
    .from('attendance_alerts')
    .select('id, staff_id, business_date, alert_type, severity, message, resolved_at, created_at')
    .eq('store_id', auth.storeId)
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (targetStaffId) {
    query = query.eq('staff_id', targetStaffId)
  }
  if (resolvedOnly === 'true') {
    query = query.not('resolved_at', 'is', null)
  } else if (resolvedOnly === 'false') {
    query = query.is('resolved_at', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: { from, to, alerts: data ?? [] } })
}
