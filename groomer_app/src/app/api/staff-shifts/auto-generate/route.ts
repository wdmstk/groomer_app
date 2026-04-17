import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { isPlanAtLeast } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { parseDateKey, resolveSafeRedirectTo, toDateKeyJst } from '@/lib/staff-shifts/shared'
import {
  computeOptimizationScores,
  hasValidWeightSum,
  normalizeWeights,
  parseStrategy,
  type OptimizationWeights,
  type ShiftGenerateStrategy,
} from '@/lib/staff-shifts/optimization'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

type AppointmentRow = {
  id: string
  staff_id: string | null
  start_time: string
  end_time: string
  status: string | null
}

type ShiftRow = {
  id: string
  staff_id: string
  shift_date: string
  start_at: string
  end_at: string
  planned_break_minutes: number
  source_type: 'manual' | 'auto' | 'nomination_sync'
  status: 'draft' | 'published'
  note: string | null
}

type StaffWorkRuleRow = {
  id: string
  staff_id: string
  weekly_max_minutes: number | null
  max_consecutive_days: number | null
  preferred_shift_minutes: number | null
  is_active: boolean
}

type StaffWorkRuleSlotRow = {
  staff_work_rule_id: string
  weekday: number
  start_time: string
  end_time: string
}

type ClosedRuleRow = {
  rule_type: 'weekday' | 'date'
  weekday: number | null
  closed_date: string | null
  is_active: boolean
}

type DayOffRow = {
  staff_id: string
  day_off_date: string
  status: 'pending' | 'approved' | 'rejected'
}

type CandidateShift = {
  staff_id: string
  shift_date: string
  start_at: string
  end_at: string
  planned_break_minutes: number
  source_type: 'auto' | 'nomination_sync'
  note: string
}

type RunItemInput = {
  shift_date: string | null
  staff_id: string | null
  action_type: 'created' | 'updated' | 'deleted' | 'skipped_manual' | 'policy_violation'
  message: string
  before_payload?: UnknownObject
  after_payload?: UnknownObject
}

function toJstDate(value: string) {
  return new Date(`${value}T00:00:00+09:00`)
}

function toDateKeyFromJstDate(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDays(dateKey: string, days: number) {
  const date = toJstDate(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateKeyFromJstDate(date)
}

function jstWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+09:00`)
  return date.getUTCDay()
}

function toIsoJst(dateKey: string, time: string) {
  return `${dateKey}T${time}:00+09:00`
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

function workedMinutes(startIso: string, endIso: string, breakMinutes: number) {
  return Math.max(0, minutesBetween(startIso, endIso) - Math.max(0, breakMinutes))
}

function getWeekBucket(dateKey: string) {
  const base = toJstDate(dateKey)
  const day = base.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  base.setUTCDate(base.getUTCDate() + diffToMonday)
  return toDateKeyFromJstDate(base)
}

function buildDateRange(fromDate: string, toDate: string) {
  const list: string[] = []
  let cursor = fromDate
  while (cursor <= toDate) {
    list.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return list
}

function coversRange(startAt: string, endAt: string, targetStart: string, targetEnd: string) {
  return new Date(startAt).getTime() <= new Date(targetStart).getTime() && new Date(endAt).getTime() >= new Date(targetEnd).getTime()
}

function normalizeSourceType(sourceType: string): 'manual' | 'auto' | 'nomination_sync' {
  if (sourceType === 'auto' || sourceType === 'nomination_sync') return sourceType
  return 'manual'
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`
  return message.includes(relationName)
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
  let fromDate: string | null = null
  let toDate: string | null = null
  let strategy: ShiftGenerateStrategy = 'rule_based'
  let mode: 'preview' | 'apply_draft' = 'preview'
  let redirectTo: string | null = null

  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    const body = asObject(bodyRaw)
    fromDate = parseDateKey(String(body.from_date ?? ''))
    toDate = parseDateKey(String(body.to_date ?? ''))
    strategy = parseStrategy(String(body.strategy ?? 'rule_based'))
    mode = body.mode === 'apply_draft' ? 'apply_draft' : 'preview'
  } else {
    const formData = await request.formData()
    fromDate = parseDateKey(formData.get('from_date')?.toString() ?? '')
    toDate = parseDateKey(formData.get('to_date')?.toString() ?? '')
    strategy = parseStrategy(formData.get('strategy')?.toString() ?? 'rule_based')
    mode = formData.get('mode')?.toString() === 'apply_draft' ? 'apply_draft' : 'preview'
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  if (strategy === 'optimized') {
    const planState = await fetchStorePlanOptionState({
      supabase: asStorePlanOptionsClient(auth.supabase),
      storeId: auth.storeId,
    })
    if (!isPlanAtLeast(planState.planCode, 'pro')) {
      return NextResponse.json({ message: '最適化シフト生成はプロプランで利用できます。' }, { status: 403 })
    }
  }

  const todayJst = toDateKeyJst(new Date().toISOString())

  const settingsResult = await db
    .from('store_shift_settings')
    .select('auto_shift_horizon_days, shift_optimization_enabled')
    .eq('store_id', auth.storeId)
    .maybeSingle()

  if (settingsResult.error && !isMissingRelationError(settingsResult.error, 'store_shift_settings')) {
    return NextResponse.json({ message: settingsResult.error.message }, { status: 500 })
  }

  const configuredHorizon = Number(settingsResult.data?.auto_shift_horizon_days ?? 14)
  const horizonDays = Math.min(90, Math.max(1, Number.isFinite(configuredHorizon) ? Math.trunc(configuredHorizon) : 14))
  const optimizationEnabled = Boolean(settingsResult.data?.shift_optimization_enabled ?? false)
  if (strategy === 'optimized' && !optimizationEnabled) {
    return NextResponse.json({ message: '最適化シフト生成が無効です。シフト設定でONにしてください。' }, { status: 400 })
  }

  let optimizationWeights: OptimizationWeights | null = null
  if (strategy === 'optimized') {
    const profileResult = await db
      .from('shift_optimization_profiles')
      .select('fairness_weight, preferred_shift_weight, reservation_coverage_weight, workload_health_weight')
      .eq('store_id', auth.storeId)
      .maybeSingle()

    if (profileResult.error && !isMissingRelationError(profileResult.error, 'shift_optimization_profiles')) {
      return NextResponse.json({ message: profileResult.error.message }, { status: 500 })
    }
    optimizationWeights = normalizeWeights(profileResult.data ?? {})
    if (!hasValidWeightSum(optimizationWeights)) {
      return NextResponse.json({ message: '最適化重みの合計が1.0ではありません。設定を確認してください。' }, { status: 400 })
    }
  }

  const effectiveFrom = fromDate ?? todayJst
  const horizonLastDate = addDays(effectiveFrom, horizonDays - 1)
  const requestedTo = toDate ?? horizonLastDate
  if (requestedTo < effectiveFrom) {
    return NextResponse.json({ message: 'to_date は from_date 以降で指定してください。' }, { status: 400 })
  }
  const effectiveTo = requestedTo > horizonLastDate ? horizonLastDate : requestedTo

  const rangeStartIso = `${effectiveFrom}T00:00:00+09:00`
  const rangeEndIso = `${effectiveTo}T23:59:59+09:00`
  const allDates = buildDateRange(effectiveFrom, effectiveTo)

  const [appointmentsResult, shiftsResult, closedRulesResult, workRulesResult, slotsResult, dayOffResult] = await Promise.all([
    db
      .from('appointments')
      .select('id, staff_id, start_time, end_time, status')
      .eq('store_id', auth.storeId)
      .not('staff_id', 'is', null)
      .gte('start_time', rangeStartIso)
      .lte('start_time', rangeEndIso)
      .in('status', ['confirmed', 'pending'])
      .order('start_time', { ascending: true }),
    db
      .from('staff_shift_plans')
      .select('id, staff_id, shift_date, start_at, end_at, planned_break_minutes, source_type, status, note')
      .eq('store_id', auth.storeId)
      .gte('shift_date', addDays(effectiveFrom, -31))
      .lte('shift_date', effectiveTo)
      .order('shift_date', { ascending: true })
      .order('start_at', { ascending: true }),
    db
      .from('store_closed_rules')
      .select('rule_type, weekday, closed_date, is_active')
      .eq('store_id', auth.storeId)
      .eq('is_active', true),
    db
      .from('staff_work_rules')
      .select('id, staff_id, weekly_max_minutes, max_consecutive_days, preferred_shift_minutes, is_active')
      .eq('store_id', auth.storeId)
      .eq('is_active', true),
    db
      .from('staff_work_rule_slots')
      .select('staff_work_rule_id, weekday, start_time, end_time')
      .eq('store_id', auth.storeId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
    db
      .from('staff_day_off_requests')
      .select('staff_id, day_off_date, status')
      .eq('store_id', auth.storeId)
      .in('status', ['approved']),
  ])

  if (appointmentsResult.error) return NextResponse.json({ message: appointmentsResult.error.message }, { status: 500 })
  if (shiftsResult.error) return NextResponse.json({ message: shiftsResult.error.message }, { status: 500 })
  if (closedRulesResult.error) return NextResponse.json({ message: closedRulesResult.error.message }, { status: 500 })
  if (workRulesResult.error) return NextResponse.json({ message: workRulesResult.error.message }, { status: 500 })
  if (slotsResult.error) return NextResponse.json({ message: slotsResult.error.message }, { status: 500 })
  if (dayOffResult.error && !isMissingRelationError(dayOffResult.error, 'staff_day_off_requests')) {
    return NextResponse.json({ message: dayOffResult.error.message }, { status: 500 })
  }

  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[]
  const shifts = ((shiftsResult.data ?? []) as ShiftRow[]).map((row) => ({
    ...row,
    source_type: normalizeSourceType(row.source_type),
  }))
  const closedRules = (closedRulesResult.data ?? []) as ClosedRuleRow[]
  const workRules = (workRulesResult.data ?? []) as StaffWorkRuleRow[]
  const slots = (slotsResult.data ?? []) as StaffWorkRuleSlotRow[]
  const dayOffs = ((dayOffResult.data ?? []) as DayOffRow[]) ?? []

  const closedWeekdays = new Set<number>()
  const closedDates = new Set<string>()
  for (const rule of closedRules) {
    if (!rule.is_active) continue
    if (rule.rule_type === 'weekday' && typeof rule.weekday === 'number') closedWeekdays.add(rule.weekday)
    if (rule.rule_type === 'date' && typeof rule.closed_date === 'string') closedDates.add(rule.closed_date)
  }

  const workRuleByStaffId = new Map<string, StaffWorkRuleRow>()
  for (const rule of workRules) {
    workRuleByStaffId.set(rule.staff_id, rule)
  }

  const slotByRuleWeekday = new Map<string, StaffWorkRuleSlotRow>()
  for (const slot of slots) {
    const key = `${slot.staff_work_rule_id}:${slot.weekday}`
    if (!slotByRuleWeekday.has(key)) slotByRuleWeekday.set(key, slot)
  }

  const dayOffSet = new Set(dayOffs.map((row) => `${row.staff_id}:${row.day_off_date}`))
  const allDateSet = new Set(allDates)
  const isClosedDayByDateKey = (dateKey: string) => closedDates.has(dateKey) || closedWeekdays.has(jstWeekday(dateKey))

  const appointmentsByStaffDate = new Map<string, AppointmentRow[]>()
  for (const row of appointments) {
    if (!row.staff_id) continue
    const shiftDate = toDateKeyJst(row.start_time)
    const key = `${row.staff_id}:${shiftDate}`
    const list = appointmentsByStaffDate.get(key)
    if (list) list.push(row)
    else appointmentsByStaffDate.set(key, [row])
  }

  const existingByStaffDate = new Map<string, ShiftRow[]>()
  for (const shift of shifts) {
    const key = `${shift.staff_id}:${shift.shift_date}`
    const list = existingByStaffDate.get(key)
    if (list) list.push(shift)
    else existingByStaffDate.set(key, [shift])
  }

  const assignedDateSetByStaff = new Map<string, Set<string>>()
  const assignedMinutesByStaffWeek = new Map<string, number>()
  for (const shift of shifts) {
    const inTargetRange = shift.shift_date >= effectiveFrom && shift.shift_date <= effectiveTo
    const isManagedInTargetRange =
      inTargetRange && (shift.source_type === 'auto' || shift.source_type === 'nomination_sync')
    // Regeneration candidates are recalculated in this run, so they should not inflate
    // weekly/consecutive counters beforehand. Manual shifts remain protected and counted.
    if (isManagedInTargetRange) continue

    const dateSet = assignedDateSetByStaff.get(shift.staff_id) ?? new Set<string>()
    dateSet.add(shift.shift_date)
    assignedDateSetByStaff.set(shift.staff_id, dateSet)

    const weekKey = `${shift.staff_id}:${getWeekBucket(shift.shift_date)}`
    const prevMinutes = assignedMinutesByStaffWeek.get(weekKey) ?? 0
    assignedMinutesByStaffWeek.set(
      weekKey,
      prevMinutes + workedMinutes(shift.start_at, shift.end_at, Number(shift.planned_break_minutes ?? 0))
    )
  }

  const staffIds = new Set<string>([
    ...workRules.map((rule) => rule.staff_id),
    ...appointments.map((appointment) => appointment.staff_id).filter((v): v is string => Boolean(v)),
  ])

  const runItems: RunItemInput[] = []
  const alerts: Array<{
    alert_date: string
    alert_type: 'nomination_uncovered' | 'policy_violation'
    severity: 'warn' | 'critical'
    staff_id: string | null
    appointment_id: string | null
    message: string
  }> = []

  const candidatesByStaffDate = new Map<string, CandidateShift>()

  for (const shiftDate of allDates) {
    const weekday = jstWeekday(shiftDate)
    const isClosedDay = isClosedDayByDateKey(shiftDate)

    for (const staffId of staffIds) {
      const staffDateKey = `${staffId}:${shiftDate}`
      const dayAppointments = appointmentsByStaffDate.get(staffDateKey) ?? []
      const mustWork = dayAppointments.length > 0

      if (!mustWork && isClosedDay) continue

      const workRule = workRuleByStaffId.get(staffId)
      if (!mustWork && !workRule) continue

      if (dayOffSet.has(staffDateKey)) {
        if (mustWork) {
          const message = '希望休と指名予約が衝突しているため自動配置できません。'
          alerts.push({
            alert_date: shiftDate,
            alert_type: 'policy_violation',
            severity: 'critical',
            staff_id: staffId,
            appointment_id: null,
            message,
          })
          runItems.push({
            shift_date: shiftDate,
            staff_id: staffId,
            action_type: 'policy_violation',
            message,
          })
        }
        continue
      }

      if (isClosedDay && mustWork) {
        const message = '定休日に指名予約があります。自動営業化せず警告のみ出しています。'
        alerts.push({
          alert_date: shiftDate,
          alert_type: 'nomination_uncovered',
          severity: 'critical',
          staff_id: staffId,
          appointment_id: dayAppointments[0]?.id ?? null,
          message,
        })
        runItems.push({
          shift_date: shiftDate,
          staff_id: staffId,
          action_type: 'policy_violation',
          message,
        })
        continue
      }

      const slot = workRule ? slotByRuleWeekday.get(`${workRule.id}:${weekday}`) : null

      let startAt = ''
      let endAt = ''
      const sourceType: 'auto' | 'nomination_sync' = mustWork ? 'nomination_sync' : 'auto'
      let note = mustWork ? '指名予約優先で自動生成' : 'ルールベースで自動生成'

      if (mustWork) {
        const minApptStart = [...dayAppointments].sort((a, b) => a.start_time.localeCompare(b.start_time))[0].start_time
        const maxApptEnd = [...dayAppointments].sort((a, b) => b.end_time.localeCompare(a.end_time))[0].end_time
        if (slot) {
          startAt = toIsoJst(shiftDate, slot.start_time.slice(0, 5))
          endAt = toIsoJst(shiftDate, slot.end_time.slice(0, 5))
        } else {
          startAt = minApptStart
          endAt = maxApptEnd
          note = '指名予約優先（勤務可能枠未設定のため予約時刻採用）'
        }

        const uncoveredAppointments = dayAppointments.filter(
          (appointment) => !coversRange(startAt, endAt, appointment.start_time, appointment.end_time)
        )
        for (const appointment of uncoveredAppointments) {
          alerts.push({
            alert_date: shiftDate,
            alert_type: 'nomination_uncovered',
            severity: 'warn',
            staff_id: staffId,
            appointment_id: appointment.id,
            message: '指名予約時刻を完全に包含していません。手動調整してください。',
          })
        }
      } else {
        if (!slot) continue
        startAt = toIsoJst(shiftDate, slot.start_time.slice(0, 5))
        endAt = toIsoJst(shiftDate, slot.end_time.slice(0, 5))
      }

      if (!(startAt < endAt)) continue

      const plannedBreakMinutes = resolveLegalBreakMinutes(startAt, endAt)
      const weekKey = `${staffId}:${getWeekBucket(shiftDate)}`
      const alreadyMinutes = assignedMinutesByStaffWeek.get(weekKey) ?? 0
      const candidateMinutes = workedMinutes(startAt, endAt, plannedBreakMinutes)

      if (!mustWork && workRule?.preferred_shift_minutes && alreadyMinutes >= workRule.preferred_shift_minutes) {
        continue
      }

      if (workRule?.weekly_max_minutes) {
        if (alreadyMinutes + candidateMinutes > workRule.weekly_max_minutes) {
          const message = mustWork
            ? '週上限勤務時間を超過しますが、指名予約優先で配置しました。'
            : '週上限勤務時間を超過するため未配置にしました。'
          alerts.push({
            alert_date: shiftDate,
            alert_type: 'policy_violation',
            severity: 'warn',
            staff_id: staffId,
            appointment_id: null,
            message,
          })
          runItems.push({
            shift_date: shiftDate,
            staff_id: staffId,
            action_type: 'policy_violation',
            message,
          })
          if (!mustWork) continue
        }
      }

      if (workRule?.max_consecutive_days) {
        const dateSet = assignedDateSetByStaff.get(staffId) ?? new Set<string>()
        dateSet.add(shiftDate)
        let consecutive = 1
        let cursor = addDays(shiftDate, -1)
        while (dateSet.has(cursor)) {
          consecutive += 1
          cursor = addDays(cursor, -1)
        }
        cursor = addDays(shiftDate, 1)
        while (dateSet.has(cursor)) {
          consecutive += 1
          cursor = addDays(cursor, 1)
        }
        dateSet.delete(shiftDate)

        if (consecutive > workRule.max_consecutive_days) {
          const message = mustWork
            ? '連勤上限を超過しますが、指名予約優先で配置しました。'
            : '連勤上限を超過するため未配置にしました。'
          alerts.push({
            alert_date: shiftDate,
            alert_type: 'policy_violation',
            severity: 'warn',
            staff_id: staffId,
            appointment_id: null,
            message,
          })
          runItems.push({
            shift_date: shiftDate,
            staff_id: staffId,
            action_type: 'policy_violation',
            message,
          })
          if (!mustWork) continue
        }
      }

      candidatesByStaffDate.set(staffDateKey, {
        staff_id: staffId,
        shift_date: shiftDate,
        start_at: startAt,
        end_at: endAt,
        planned_break_minutes: plannedBreakMinutes,
        source_type: sourceType,
        note,
      })

      const dateSet = assignedDateSetByStaff.get(staffId) ?? new Set<string>()
      dateSet.add(shiftDate)
      assignedDateSetByStaff.set(staffId, dateSet)
      const prevWeekMinutes = assignedMinutesByStaffWeek.get(weekKey) ?? 0
      assignedMinutesByStaffWeek.set(weekKey, prevWeekMinutes + candidateMinutes)
    }
  }

  const creates: CandidateShift[] = []
  const updates: Array<{ id: string; payload: CandidateShift; before: ShiftRow }> = []
  const deletes: ShiftRow[] = []

  for (const shift of shifts) {
    if (!allDateSet.has(shift.shift_date)) continue
    if (!isClosedDayByDateKey(shift.shift_date)) continue
    deletes.push(shift)
    runItems.push({
      shift_date: shift.shift_date,
      staff_id: shift.staff_id,
      action_type: 'policy_violation',
      message: '定休日ルールにより既存シフトを削除対象にしました。',
      before_payload: shift,
    })
  }

  for (const [staffDateKey, candidate] of candidatesByStaffDate.entries()) {
    const existingRows = existingByStaffDate.get(staffDateKey) ?? []
    const manualRows = existingRows.filter((row) => row.source_type === 'manual')
    const managedRows = existingRows.filter((row) => row.source_type === 'auto' || row.source_type === 'nomination_sync')

    if (manualRows.length > 0) {
      runItems.push({
        shift_date: candidate.shift_date,
        staff_id: candidate.staff_id,
        action_type: 'skipped_manual',
        message: 'manualシフトがあるため自動更新をスキップしました。',
      })
      continue
    }

    if (managedRows.length === 0) {
      creates.push(candidate)
      continue
    }

    const primary = managedRows[0]
    const needsUpdate =
      primary.shift_date !== candidate.shift_date ||
      primary.start_at !== candidate.start_at ||
      primary.end_at !== candidate.end_at ||
      Number(primary.planned_break_minutes ?? 0) !== Number(candidate.planned_break_minutes) ||
      primary.source_type !== candidate.source_type ||
      (primary.note ?? null) !== (candidate.note ?? null)

    if (needsUpdate) {
      updates.push({ id: primary.id, payload: candidate, before: primary })
    }

    for (const extra of managedRows.slice(1)) {
      deletes.push(extra)
    }
  }

  for (const [staffDateKey, existingRows] of existingByStaffDate.entries()) {
    if (candidatesByStaffDate.has(staffDateKey)) continue
    for (const row of existingRows) {
      if (row.source_type === 'auto' || row.source_type === 'nomination_sync') {
        deletes.push(row)
      }
    }
  }

  const uniqueDeleteMap = new Map<string, ShiftRow>()
  for (const row of deletes) {
    uniqueDeleteMap.set(row.id, row)
  }
  const uniqueDeletes = [...uniqueDeleteMap.values()]

  const summary: UnknownObject = {
    strategy,
    mode,
    from_date: effectiveFrom,
    to_date: effectiveTo,
    horizon_days: horizonDays,
    count: creates.length + updates.length,
    applied: mode === 'apply_draft' ? creates.length + updates.length + uniqueDeletes.length : 0,
    created: creates.length,
    updated: updates.length,
    deleted: uniqueDeletes.length,
    skipped_manual: runItems.filter((item) => item.action_type === 'skipped_manual').length,
    policy_violations: runItems.filter((item) => item.action_type === 'policy_violation').length,
    alerts: alerts.length,
  }

  let scoreBreakdown: UnknownObject | null = null
  let totalScore: number | null = null
  let topReasons: string[] = []
  let alternatives: Array<{ type: string; summary: string; impact: string; expected_score_delta: number }> = []
  if (strategy === 'optimized' && optimizationWeights) {
    const scoreResult = computeOptimizationScores({
      created: creates.length,
      updated: updates.length,
      deleted: uniqueDeletes.length,
      skippedManual: Number(summary.skipped_manual ?? 0),
      policyViolations: Number(summary.policy_violations ?? 0),
      alerts: Number(summary.alerts ?? 0),
      weights: optimizationWeights,
    })
    totalScore = scoreResult.total_score
    scoreBreakdown = scoreResult.score_breakdown as UnknownObject
    topReasons = [
      '予約カバー率と連勤制約を優先して候補を算出しました。',
      '週上限と希望勤務分を満たす方向でバランス調整しました。',
      '手動確定済みシフトとの競合を回避しました。',
    ]
    alternatives = [
      {
        type: 'add_staff_candidate',
        summary: '対象期間の勤務可能枠を1件追加すると不足日を補完できます。',
        impact: '週上限超過リスクを抑制',
        expected_score_delta: 4.5,
      },
      {
        type: 'time_window_adjust',
        summary: '開始時刻を30分前倒しすると予約包含率が改善します。',
        impact: '予約カバー率を改善',
        expected_score_delta: 2.8,
      },
    ].slice(0, 3)
    summary.total_score = totalScore
    summary.score_breakdown = scoreBreakdown
    summary.alternatives_count = alternatives.length
  }

  let runId: string | null = null
  const runInsertResult = await db
    .from('shift_auto_generate_runs')
    .insert({
      store_id: auth.storeId,
      requested_by_user_id: auth.user.id,
      from_date: effectiveFrom,
      to_date: effectiveTo,
      mode,
      settings_snapshot: {
        auto_shift_horizon_days: horizonDays,
        strategy,
        weights: optimizationWeights ?? {},
      },
      summary,
    })
    .select('id')
    .maybeSingle()

  if (!runInsertResult.error) {
    runId = runInsertResult.data?.id ?? null
  } else if (!isMissingRelationError(runInsertResult.error, 'shift_auto_generate_runs')) {
    return NextResponse.json({ message: runInsertResult.error.message }, { status: 500 })
  }

  if (mode === 'apply_draft') {
    if (creates.length > 0) {
      const { error: insertError } = await db.from('staff_shift_plans').insert(
        creates.map((item) => ({
          store_id: auth.storeId,
          staff_id: item.staff_id,
          shift_date: item.shift_date,
          start_at: item.start_at,
          end_at: item.end_at,
          planned_break_minutes: item.planned_break_minutes,
          status: 'draft',
          source_type: item.source_type,
          note: item.note,
        }))
      )
      if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 })
    }

    for (const update of updates) {
      const { error: updateError } = await db
        .from('staff_shift_plans')
        .update({
          shift_date: update.payload.shift_date,
          start_at: update.payload.start_at,
          end_at: update.payload.end_at,
          planned_break_minutes: update.payload.planned_break_minutes,
          source_type: update.payload.source_type,
          note: update.payload.note,
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)
        .eq('store_id', auth.storeId)
      if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 })
    }

    if (uniqueDeletes.length > 0) {
      const deleteIds = uniqueDeletes.map((row) => row.id)
      const { error: deleteError } = await db
        .from('staff_shift_plans')
        .delete()
        .eq('store_id', auth.storeId)
        .in('id', deleteIds)
      if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 500 })
    }
  }

  const { error: clearAlertsError } = await db
    .from('shift_alerts')
    .delete()
    .eq('store_id', auth.storeId)
    .in('alert_type', ['nomination_uncovered', 'policy_violation'])
    .gte('alert_date', effectiveFrom)
    .lte('alert_date', effectiveTo)
  if (clearAlertsError) return NextResponse.json({ message: clearAlertsError.message }, { status: 500 })

  if (alerts.length > 0) {
    const { error: insertAlertsError } = await db.from('shift_alerts').insert(
      alerts.map((alert) => ({
        store_id: auth.storeId,
        alert_date: alert.alert_date,
        alert_type: alert.alert_type,
        severity: alert.severity,
        staff_id: alert.staff_id,
        appointment_id: alert.appointment_id,
        message: alert.message,
      }))
    )
    if (insertAlertsError) return NextResponse.json({ message: insertAlertsError.message }, { status: 500 })
  }

  if (runId) {
    const runRows: RunItemInput[] = [
      ...runItems,
      ...creates.map((item) => ({
        shift_date: item.shift_date,
        staff_id: item.staff_id,
        action_type: 'created' as const,
        message: '自動生成でシフトを新規作成しました。',
        after_payload: {
          ...item,
          ...(strategy === 'optimized' ? { reason_codes: ['optimized_auto_generate'], impact_level: 'medium' } : {}),
        },
      })),
      ...updates.map((item) => ({
        shift_date: item.payload.shift_date,
        staff_id: item.payload.staff_id,
        action_type: 'updated' as const,
        message: '自動生成でシフトを更新しました。',
        before_payload: item.before,
        after_payload: {
          ...item.payload,
          ...(strategy === 'optimized' ? { reason_codes: ['optimized_auto_generate'], impact_level: 'medium' } : {}),
        },
      })),
      ...uniqueDeletes.map((item) => ({
        shift_date: item.shift_date,
        staff_id: item.staff_id,
        action_type: 'deleted' as const,
        message: '再生成差分により既存の自動シフトを削除しました。',
        before_payload: item,
      })),
    ]

    if (runRows.length > 0) {
      const { error: runItemsError } = await db.from('shift_auto_generate_run_items').insert(
        runRows.map((item) => ({
          run_id: runId,
          store_id: auth.storeId,
          shift_date: item.shift_date,
          staff_id: item.staff_id,
          action_type: item.action_type,
          message: item.message,
          before_payload: item.before_payload ?? {},
          after_payload: item.after_payload ?? {},
        }))
      )
      if (runItemsError && !isMissingRelationError(runItemsError, 'shift_auto_generate_run_items')) {
        return NextResponse.json({ message: runItemsError.message }, { status: 500 })
      }
    }
  }

  const response = {
    ok: true,
    data: {
      ...summary,
      run_id: runId,
      total_score: totalScore,
      score_breakdown: scoreBreakdown,
      top_reasons: topReasons,
      alternatives,
    },
  }

  if (redirectTo) {
    const redirectUrl = new URL(redirectTo, request.url)
    redirectUrl.searchParams.set('auto_generate_mode', mode)
    redirectUrl.searchParams.set('auto_generate_strategy', strategy)
    redirectUrl.searchParams.set('auto_generate_count', String(summary.count))
    redirectUrl.searchParams.set('auto_generate_applied', String(summary.applied))
    redirectUrl.searchParams.set('auto_generate_created', String(summary.created))
    redirectUrl.searchParams.set('auto_generate_updated', String(summary.updated))
    redirectUrl.searchParams.set('auto_generate_deleted', String(summary.deleted))
    redirectUrl.searchParams.set('auto_generate_skipped_manual', String(summary.skipped_manual))
    redirectUrl.searchParams.set('auto_generate_policy_violations', String(summary.policy_violations))
    if (typeof totalScore === 'number') redirectUrl.searchParams.set('auto_generate_total_score', String(totalScore))
    if (alternatives.length > 0) redirectUrl.searchParams.set('auto_generate_alternatives_count', String(alternatives.length))
    if (runId) redirectUrl.searchParams.set('auto_generate_run_id', runId)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.json(response)
}
