import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import {
  parseDateKey,
  parseDateTimeJst,
  parseInteger,
  resolveSafeRedirectTo,
} from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function getDefaultRange() {
  const now = new Date()
  const from = now.toISOString().slice(0, 10)
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { from, to }
}

function normalizeSourceType(value: string | null | undefined) {
  if (value === 'auto' || value === 'nomination_sync') return value
  return 'manual'
}

export async function GET(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin', 'staff'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const db = toAnyClient(auth.supabase)

  const url = new URL(request.url)
  const defaultRange = getDefaultRange()
  const fromDate = parseDateKey(url.searchParams.get('from')) ?? defaultRange.from
  const toDate = parseDateKey(url.searchParams.get('to')) ?? defaultRange.to
  const staffId = (url.searchParams.get('staff_id') ?? '').trim()

  let query = db
    .from('staff_shift_plans')
    .select('id, staff_id, shift_date, start_at, end_at, planned_break_minutes, status, source_type, source_appointment_id, note, created_at')
    .eq('store_id', auth.storeId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .order('shift_date', { ascending: true })
    .order('start_at', { ascending: true })
  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: { shifts: data ?? [] } })
}

export async function POST(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const db = toAnyClient(auth.supabase)

  const contentType = request.headers.get('content-type') ?? ''
  let payload: UnknownObject = {}
  let redirectTo: string | null = null

  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    payload = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    payload = {
      staff_id: formData.get('staff_id')?.toString() ?? '',
      shift_date: formData.get('shift_date')?.toString() ?? '',
      start_time: formData.get('start_time')?.toString() ?? '',
      end_time: formData.get('end_time')?.toString() ?? '',
      planned_break_minutes: formData.get('planned_break_minutes')?.toString() ?? '0',
      note: formData.get('note')?.toString() ?? null,
      source_type: formData.get('source_type')?.toString() ?? 'manual',
      source_appointment_id: formData.get('source_appointment_id')?.toString() ?? null,
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const staffId = String(payload.staff_id ?? '').trim()
  const shiftDate = parseDateKey(String(payload.shift_date ?? ''))
  const startTime = String(payload.start_time ?? '').trim()
  const endTime = String(payload.end_time ?? '').trim()
  if (!staffId || !shiftDate || !startTime || !endTime) {
    return NextResponse.json({ message: 'staff_id/shift_date/start_time/end_time は必須です。' }, { status: 400 })
  }

  const startAt = parseDateTimeJst(shiftDate, startTime)
  const endAt = parseDateTimeJst(shiftDate, endTime)
  if (!startAt || !endAt || startAt >= endAt) {
    return NextResponse.json({ message: '開始・終了時刻が不正です。' }, { status: 400 })
  }

  const plannedBreakMinutes = Math.max(0, parseInteger(String(payload.planned_break_minutes ?? '0'), 0))
  const sourceType = normalizeSourceType(String(payload.source_type ?? 'manual'))

  const { error } = await db.from('staff_shift_plans').insert({
    store_id: auth.storeId,
    staff_id: staffId,
    shift_date: shiftDate,
    start_at: startAt,
    end_at: endAt,
    planned_break_minutes: plannedBreakMinutes,
    status: 'draft',
    source_type: sourceType,
    source_appointment_id:
      typeof payload.source_appointment_id === 'string' && payload.source_appointment_id
        ? payload.source_appointment_id
        : null,
    note: typeof payload.note === 'string' && payload.note ? payload.note : null,
  })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
