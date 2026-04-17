import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'

export async function GET(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const url = new URL(request.url)
  const date = (url.searchParams.get('date') ?? '').trim()
  const staffIdQuery = (url.searchParams.get('staff_id') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = staffIdQuery || ownStaffId

  if (auth.role === 'staff' && targetStaffId !== ownStaffId) {
    return NextResponse.json({ message: '他スタッフの勤務実績は閲覧できません。' }, { status: 403 })
  }

  let query = auth.supabase
    .from('attendance_daily_summaries')
    .select('id, staff_id, business_date, clock_in_at, clock_out_at, break_minutes, worked_minutes, status, flags, updated_at')
    .eq('store_id', auth.storeId)
    .order('business_date', { ascending: false })

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) query = query.eq('business_date', date)
  if (targetStaffId) query = query.eq('staff_id', targetStaffId)

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: { summaries: data ?? [] } })
}
