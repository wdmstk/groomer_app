import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'

function parseMonth(value: string | null) {
  const candidate = (value ?? '').trim()
  if (/^\d{4}-\d{2}$/.test(candidate)) return candidate
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}

function monthRange(month: string) {
  const start = `${month}-01`
  const [year, mon] = month.split('-').map((v) => Number(v))
  const next = new Date(Date.UTC(year, mon, 1))
  next.setUTCDate(next.getUTCDate() - 1)
  const end = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(next)
  return { start, end }
}

function toDateKeyJst(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function GET(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })

  const url = new URL(request.url)
  const month = parseMonth(url.searchParams.get('month'))
  const { start, end } = monthRange(month)
  const requestedStaffId = (url.searchParams.get('staff_id') ?? '').trim()

  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = auth.role === 'staff' ? ownStaffId : (requestedStaffId || ownStaffId)
  if (!targetStaffId) {
    return NextResponse.json({ message: '対象スタッフが見つかりません。' }, { status: 400 })
  }

  const { data: summaries, error: summaryError } = await auth.supabase
    .from('attendance_daily_summaries')
    .select('business_date, clock_in_at, clock_out_at, break_minutes, worked_minutes, status, flags')
    .eq('store_id', auth.storeId)
    .eq('staff_id', targetStaffId)
    .gte('business_date', start)
    .lte('business_date', end)
    .order('business_date', { ascending: true })
  if (summaryError) return NextResponse.json({ message: summaryError.message }, { status: 500 })

  const { data: events, error: eventError } = await auth.supabase
    .from('attendance_events')
    .select('business_date, event_type, occurred_at')
    .eq('store_id', auth.storeId)
    .eq('staff_id', targetStaffId)
    .gte('business_date', start)
    .lte('business_date', end)
    .in('event_type', ['break_start', 'break_end'])
    .order('occurred_at', { ascending: true })
  if (eventError) return NextResponse.json({ message: eventError.message }, { status: 500 })

  const summaryByDate = new Map((summaries ?? []).map((row) => [row.business_date, row]))
  const breakStartByDate = new Map<string, string>()
  const breakEndByDate = new Map<string, string>()
  for (const event of events ?? []) {
    if (event.event_type === 'break_start') {
      const prev = breakStartByDate.get(event.business_date)
      if (!prev || event.occurred_at < prev) breakStartByDate.set(event.business_date, event.occurred_at)
      continue
    }
    const prev = breakEndByDate.get(event.business_date)
    if (!prev || event.occurred_at > prev) breakEndByDate.set(event.business_date, event.occurred_at)
  }

  const [year, mon] = month.split('-').map((v) => Number(v))
  const date = new Date(Date.UTC(year, mon - 1, 1))
  const last = new Date(Date.UTC(year, mon, 0))
  const rows: Array<{
    business_date: string
    clock_in_at: string | null
    clock_out_at: string | null
    break_start_at: string | null
    break_end_at: string | null
    break_minutes: number
    worked_minutes: number
    status: string
    flags: unknown
  }> = []
  while (date <= last) {
    const key = toDateKeyJst(date)
    const summary = summaryByDate.get(key)
    rows.push({
      business_date: key,
      clock_in_at: summary?.clock_in_at ?? null,
      clock_out_at: summary?.clock_out_at ?? null,
      break_start_at: breakStartByDate.get(key) ?? null,
      break_end_at: breakEndByDate.get(key) ?? null,
      break_minutes: Number(summary?.break_minutes ?? 0),
      worked_minutes: Number(summary?.worked_minutes ?? 0),
      status: summary?.status ?? 'none',
      flags: summary?.flags ?? {},
    })
    date.setUTCDate(date.getUTCDate() + 1)
  }

  const totals = rows.reduce(
    (acc, row) => {
      if (row.status !== 'none') acc.attendance_days += 1
      if (row.status === 'incomplete') acc.incomplete_days += 1
      if (row.status === 'needs_review') acc.needs_review_days += 1
      acc.total_worked_minutes += row.worked_minutes
      acc.total_break_minutes += row.break_minutes
      return acc
    },
    {
      attendance_days: 0,
      incomplete_days: 0,
      needs_review_days: 0,
      total_worked_minutes: 0,
      total_break_minutes: 0,
    }
  )

  return NextResponse.json({
    ok: true,
    data: {
      month,
      staff_id: targetStaffId,
      from: start,
      to: end,
      rows,
      totals,
    },
  })
}
