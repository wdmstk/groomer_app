import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'

function dateOrDefault(value: string | null, fallback: string) {
  const v = (value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback
}

export async function GET(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })
  const url = new URL(request.url)
  const today = new Date().toISOString().slice(0, 10)
  const fromDate = dateOrDefault(url.searchParams.get('from'), today)
  const toDate = dateOrDefault(
    url.searchParams.get('to'),
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (!ownStaff?.id) {
    return NextResponse.json({ ok: true, data: { summaries: [] } })
  }

  const { data, error } = await auth.supabase
    .from('attendance_daily_summaries')
    .select('id, business_date, clock_in_at, clock_out_at, break_minutes, worked_minutes, status, flags, updated_at')
    .eq('store_id', auth.storeId)
    .eq('staff_id', ownStaff.id)
    .gte('business_date', fromDate)
    .lte('business_date', toDate)
    .order('business_date', { ascending: true })
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: { summaries: data ?? [] } })
}
