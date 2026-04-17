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

function csvEscape(value: string | number) {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
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
    .select('id, full_name')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? ''
  const targetStaffId = auth.role === 'staff' ? ownStaffId : requestedStaffId

  let query = auth.supabase
    .from('attendance_daily_summaries')
    .select('staff_id, business_date, break_minutes, worked_minutes, status, flags')
    .eq('store_id', auth.storeId)
    .gte('business_date', start)
    .lte('business_date', end)
    .order('business_date', { ascending: true })

  if (targetStaffId) {
    query = query.eq('staff_id', targetStaffId)
  }

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  const staffIds = Array.from(new Set((rows ?? []).map((row) => row.staff_id)))
  const { data: staffs } =
    staffIds.length > 0
      ? await auth.supabase.from('staffs').select('id, full_name').eq('store_id', auth.storeId).in('id', staffIds)
      : { data: [] }
  const nameById = new Map((staffs ?? []).map((s) => [s.id, s.full_name]))

  const header = ['日付', 'スタッフ', '勤務(分)', '休憩(分)', '状態', '休暇フラグ']
  const lines = [header.join(',')]
  for (const row of rows ?? []) {
    const flagText = row.flags && typeof row.flags === 'object' ? JSON.stringify(row.flags) : ''
    lines.push(
      [
        row.business_date,
        nameById.get(row.staff_id) ?? row.staff_id,
        Number(row.worked_minutes ?? 0),
        Number(row.break_minutes ?? 0),
        row.status ?? '',
        flagText,
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  const csv = `\uFEFF${lines.join('\n')}`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
