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
  const requestedStaffId = (url.searchParams.get('staff_id') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = auth.role === 'staff' ? ownStaffId : (requestedStaffId || ownStaffId)
  if (!targetStaffId) return NextResponse.json({ message: '対象スタッフが見つかりません。' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('staff_leave_balances')
    .select('id, staff_id, leave_type, granted_days, used_days, carry_over_days, expired_days, remaining_days, effective_from, effective_to, updated_at')
    .eq('store_id', auth.storeId)
    .eq('staff_id', targetStaffId)
    .order('effective_from', { ascending: false })

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: { staff_id: targetStaffId, balances: data ?? [] } })
}
