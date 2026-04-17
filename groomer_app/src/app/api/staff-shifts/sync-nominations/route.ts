import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import {
  isOverlappingRange,
  parseDateKey,
  resolveSafeRedirectTo,
  toDateKeyJst,
} from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

type AppointmentRow = {
  id: string
  staff_id: string | null
  start_time: string
  end_time: string
}

type ShiftRow = {
  id: string
  staff_id: string
  source_appointment_id: string | null
  shift_date: string
  source_type: 'manual' | 'auto' | 'nomination_sync'
  start_at: string
  end_at: string
}

type ClosedRuleRow = {
  rule_type: 'weekday' | 'date'
  weekday: number | null
  closed_date: string | null
  is_active: boolean
}

function jstWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+09:00`)
  return date.getUTCDay()
}

function minutesBetween(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.floor((end - start) / 60000)
}

function resolveLegalBreakMinutes(startIso: string, endIso: string) {
  const scheduledMinutes = minutesBetween(startIso, endIso)
  if (scheduledMinutes > 8 * 60) return 60
  if (scheduledMinutes > 6 * 60) return 45
  return 0
}

function hasCoveringShift(appointment: AppointmentRow, shifts: ShiftRow[]) {
  return shifts.some(
    (shift) =>
      shift.staff_id === appointment.staff_id &&
      isOverlappingRange(appointment.start_time, appointment.end_time, shift.start_at, shift.end_at)
  )
}

export async function POST(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const db = toAnyClient(auth.supabase)

  const url = new URL(request.url)
  let fromDate = parseDateKey(url.searchParams.get('from_date'))
  let toDate = parseDateKey(url.searchParams.get('to_date'))
  let redirectTo: string | null = null
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const formData = await request.formData()
    fromDate = parseDateKey(formData.get('from_date')?.toString() ?? '') ?? fromDate
    toDate = parseDateKey(formData.get('to_date')?.toString() ?? '') ?? toDate
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const now = new Date()
  const rangeStartIso = fromDate ? `${fromDate}T00:00:00+09:00` : now.toISOString()
  const rangeEndIso = toDate
    ? `${toDate}T23:59:59+09:00`
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: appointments, error: appointmentsError } = await db
    .from('appointments')
    .select('id, staff_id, start_time, end_time')
    .eq('store_id', auth.storeId)
    .not('staff_id', 'is', null)
    .gte('start_time', rangeStartIso)
    .lte('start_time', rangeEndIso)
    .in('status', ['confirmed', 'pending'])
    .order('start_time', { ascending: true })

  if (appointmentsError) {
    return NextResponse.json({ message: appointmentsError.message }, { status: 500 })
  }

  const { data: shifts, error: shiftsError } = await db
    .from('staff_shift_plans')
    .select('id, staff_id, source_appointment_id, shift_date, source_type, start_at, end_at')
    .eq('store_id', auth.storeId)
    .gte('start_at', rangeStartIso)
    .lte('start_at', rangeEndIso)

  if (shiftsError) {
    return NextResponse.json({ message: shiftsError.message }, { status: 500 })
  }

  const { data: closedRules, error: closedRulesError } = await db
    .from('store_closed_rules')
    .select('rule_type, weekday, closed_date, is_active')
    .eq('store_id', auth.storeId)
    .eq('is_active', true)
  if (closedRulesError && !`${closedRulesError.message}`.includes('store_closed_rules')) {
    return NextResponse.json({ message: closedRulesError.message }, { status: 500 })
  }

  const closedWeekdays = new Set<number>()
  const closedDates = new Set<string>()
  ;((closedRules ?? []) as ClosedRuleRow[]).forEach((rule) => {
    if (!rule.is_active) return
    if (rule.rule_type === 'weekday' && typeof rule.weekday === 'number') closedWeekdays.add(rule.weekday)
    if (rule.rule_type === 'date' && typeof rule.closed_date === 'string') closedDates.add(rule.closed_date)
  })
  const isClosedDate = (dateKey: string) => {
    if (closedDates.has(dateKey)) return true
    const weekday = jstWeekday(dateKey)
    if (!Number.isInteger(weekday)) return false
    return closedWeekdays.has(weekday)
  }

  const appointmentRows = ((appointments ?? []) as AppointmentRow[]).filter((row) => Boolean(row.staff_id))
  const shiftRows = (shifts ?? []) as ShiftRow[]

  const staleClosedNominationShiftIds = shiftRows
    .filter((row) => row.source_type === 'nomination_sync')
    .filter((row) => isClosedDate(row.shift_date))
    .map((row) => row.id)
  if (staleClosedNominationShiftIds.length > 0) {
    const { error: staleClosedDeleteError } = await db
      .from('staff_shift_plans')
      .delete()
      .eq('store_id', auth.storeId)
      .in('id', staleClosedNominationShiftIds)
    if (staleClosedDeleteError) {
      return NextResponse.json({ message: staleClosedDeleteError.message }, { status: 500 })
    }
  }

  const uncovered = appointmentRows.filter((appointment) => !hasCoveringShift(appointment, shiftRows))

  const { error: clearAlertsError } = await db
    .from('shift_alerts')
    .delete()
    .eq('store_id', auth.storeId)
    .eq('alert_type', 'nomination_uncovered')
    .gte('alert_date', rangeStartIso.slice(0, 10))
    .lte('alert_date', rangeEndIso.slice(0, 10))
  if (clearAlertsError) {
    return NextResponse.json({ message: clearAlertsError.message }, { status: 500 })
  }

  const alerts = uncovered.map((appointment) => ({
    store_id: auth.storeId,
    alert_date: toDateKeyJst(appointment.start_time),
    alert_type: 'nomination_uncovered',
    severity: 'warn',
    staff_id: appointment.staff_id,
    appointment_id: appointment.id,
    message: '指名予約に対するシフトが未配置です。',
  }))

  if (alerts.length > 0) {
    const { error: insertAlertsError } = await db.from('shift_alerts').insert(alerts)
    if (insertAlertsError) {
      return NextResponse.json({ message: insertAlertsError.message }, { status: 500 })
    }
  }

  const shiftByAppointmentId = new Set(
    shiftRows
      .map((row) => row.source_appointment_id)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
  )

  const nominationCandidates = uncovered
    .filter((row) => !shiftByAppointmentId.has(row.id))
    .filter((row) => !isClosedDate(toDateKeyJst(row.start_time)))
    .map((appointment) => ({
      store_id: auth.storeId,
      staff_id: appointment.staff_id,
      shift_date: toDateKeyJst(appointment.start_time),
      start_at: appointment.start_time,
      end_at: appointment.end_time,
      planned_break_minutes: resolveLegalBreakMinutes(appointment.start_time, appointment.end_time),
      status: 'draft',
      source_type: 'nomination_sync',
      source_appointment_id: appointment.id,
      note: '指名予約連動で自動提案',
    }))

  const closedUncoveredAppointmentIds = uncovered
    .filter((row) => isClosedDate(toDateKeyJst(row.start_time)))
    .map((row) => row.id)

  if (closedUncoveredAppointmentIds.length > 0) {
    const { error: cleanupError } = await db
      .from('staff_shift_plans')
      .delete()
      .eq('store_id', auth.storeId)
      .eq('source_type', 'nomination_sync')
      .in('source_appointment_id', closedUncoveredAppointmentIds)
    if (cleanupError) {
      return NextResponse.json({ message: cleanupError.message }, { status: 500 })
    }
  }

  if (nominationCandidates.length > 0) {
    const { error: insertShiftsError } = await db.from('staff_shift_plans').insert(nominationCandidates)
    if (insertShiftsError) {
      return NextResponse.json({ message: insertShiftsError.message }, { status: 500 })
    }
  }

  const response = {
    ok: true,
    data: {
      appointments: appointmentRows.length,
      uncovered: uncovered.length,
      alerts_created: alerts.length,
      shifts_suggested: nominationCandidates.length,
    },
  }
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }
  return NextResponse.json(response)
}
