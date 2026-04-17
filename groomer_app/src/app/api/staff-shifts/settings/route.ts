import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import {
  parseBoolean,
  parseDateKeyList,
  parseInteger,
  parseWeekdayList,
  resolveSafeRedirectTo,
} from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function parseBooleanFromFormData(formData: FormData, key: string) {
  const values = formData.getAll(key)
  if (values.length === 0) return false
  return values.some((value) => parseBoolean(value))
}

function normalizePolicyPriority(value: string | null | undefined) {
  if (value === 'cost_first' || value === 'fairness_first') return value
  return 'nomination_first'
}

function hasOwnKey(object: UnknownObject, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export async function GET() {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin', 'staff'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const db = toAnyClient(auth.supabase)
  const [settingsResult, closedRulesResult] = await Promise.all([
    db.from('store_shift_settings').select('*').eq('store_id', auth.storeId).maybeSingle(),
    db
      .from('store_closed_rules')
      .select('id, rule_type, weekday, closed_date, note, is_active')
      .eq('store_id', auth.storeId)
      .eq('is_active', true)
      .order('rule_type', { ascending: true }),
  ])

  if (settingsResult.error && !`${settingsResult.error.message}`.includes('store_shift_settings')) {
    return NextResponse.json({ message: settingsResult.error.message }, { status: 500 })
  }
  if (closedRulesResult.error && !`${closedRulesResult.error.message}`.includes('store_closed_rules')) {
    return NextResponse.json({ message: closedRulesResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      settings: settingsResult.data ?? null,
      closed_rules: closedRulesResult.data ?? [],
    },
  })
}

export async function PUT(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const contentType = request.headers.get('content-type') ?? ''
  const db = toAnyClient(auth.supabase)

  let payload: UnknownObject = {}
  let redirectTo: string | null = null
  let closedWeekdaysFromChecks: number[] = []
  let shouldUpdateClosedRules = false
  let hasAttendancePunchField = false
  let hasAttendanceLocationField = false
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    payload = asObject(bodyRaw)
    shouldUpdateClosedRules = hasOwnKey(payload, 'closed_weekdays_csv') || hasOwnKey(payload, 'closed_dates_text')
    hasAttendancePunchField = hasOwnKey(payload, 'attendance_punch_enabled')
    hasAttendanceLocationField = hasOwnKey(payload, 'attendance_location_required')
  } else {
    const formData = await request.formData()
    closedWeekdaysFromChecks = formData
      .getAll('closed_weekdays')
      .map((v) => Number(v.toString()))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    shouldUpdateClosedRules =
      formData.has('closed_weekdays') || formData.has('closed_weekdays_csv') || formData.has('closed_dates_text')
    hasAttendancePunchField = formData.has('attendance_punch_enabled')
    hasAttendanceLocationField = formData.has('attendance_location_required')
    payload = {
      timezone: formData.get('timezone')?.toString() ?? null,
      default_open_time: formData.get('default_open_time')?.toString() ?? null,
      default_close_time: formData.get('default_close_time')?.toString() ?? null,
      late_grace_minutes: formData.get('late_grace_minutes')?.toString() ?? null,
      early_leave_grace_minutes: formData.get('early_leave_grace_minutes')?.toString() ?? null,
      auto_shift_enabled: formData.get('auto_shift_enabled'),
      auto_shift_horizon_days: formData.get('auto_shift_horizon_days')?.toString() ?? null,
      policy_priority: formData.get('policy_priority')?.toString() ?? null,
      attendance_punch_enabled: parseBooleanFromFormData(formData, 'attendance_punch_enabled'),
      attendance_location_required: parseBooleanFromFormData(formData, 'attendance_location_required'),
      closed_weekdays_csv:
        closedWeekdaysFromChecks.length > 0
          ? closedWeekdaysFromChecks.join(',')
          : formData.get('closed_weekdays_csv')?.toString() ?? null,
      closed_dates_text: formData.get('closed_dates_text')?.toString() ?? null,
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const timezone = typeof payload.timezone === 'string' && payload.timezone ? payload.timezone : 'Asia/Tokyo'
  const defaultOpenTime = typeof payload.default_open_time === 'string' && payload.default_open_time ? payload.default_open_time : null
  const defaultCloseTime = typeof payload.default_close_time === 'string' && payload.default_close_time ? payload.default_close_time : null
  const lateGraceMinutes = parseInteger(String(payload.late_grace_minutes ?? ''), 10)
  const earlyLeaveGraceMinutes = parseInteger(String(payload.early_leave_grace_minutes ?? ''), 10)
  const autoShiftEnabled = parseBoolean((payload.auto_shift_enabled as FormDataEntryValue | null | undefined) ?? null)
  const autoShiftHorizonDays = parseInteger(String(payload.auto_shift_horizon_days ?? ''), 14)
  const policyPriority = normalizePolicyPriority(String(payload.policy_priority ?? ''))

  const upsertPayload: UnknownObject = {
    store_id: auth.storeId,
    timezone,
    default_open_time: defaultOpenTime,
    default_close_time: defaultCloseTime,
    late_grace_minutes: Math.max(0, lateGraceMinutes),
    early_leave_grace_minutes: Math.max(0, earlyLeaveGraceMinutes),
    auto_shift_enabled: autoShiftEnabled,
    auto_shift_horizon_days: Math.min(90, Math.max(1, autoShiftHorizonDays)),
    policy_priority: policyPriority,
    updated_at: new Date().toISOString(),
  }
  if (hasAttendancePunchField) {
    upsertPayload.attendance_punch_enabled = parseBoolean(
      (payload.attendance_punch_enabled as FormDataEntryValue | null | undefined) ?? null
    )
  }
  if (hasAttendanceLocationField) {
    upsertPayload.attendance_location_required = parseBoolean(
      (payload.attendance_location_required as FormDataEntryValue | null | undefined) ?? null
    )
  }

  const { error: upsertError } = await db.from('store_shift_settings').upsert(upsertPayload, {
    onConflict: 'store_id',
  })
  if (upsertError) return NextResponse.json({ message: upsertError.message }, { status: 500 })

  if (shouldUpdateClosedRules) {
    const closedWeekdays = parseWeekdayList(String(payload.closed_weekdays_csv ?? ''))
    const closedDates = parseDateKeyList(String(payload.closed_dates_text ?? ''))

    const { error: deleteError } = await db
      .from('store_closed_rules')
      .delete()
      .eq('store_id', auth.storeId)
    if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 500 })

    const insertRows = [
      ...closedWeekdays.map((weekday) => ({
        store_id: auth.storeId,
        rule_type: 'weekday',
        weekday,
        closed_date: null,
        note: 'settings_ui',
        is_active: true,
      })),
      ...closedDates.map((closedDate) => ({
        store_id: auth.storeId,
        rule_type: 'date',
        weekday: null,
        closed_date: closedDate,
        note: 'settings_ui',
        is_active: true,
      })),
    ]

    if (insertRows.length > 0) {
      const { error: insertError } = await db.from('store_closed_rules').insert(insertRows)
      if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 })
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  return PUT(request)
}
