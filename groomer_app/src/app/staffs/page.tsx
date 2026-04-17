import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { InviteManager } from '@/components/staffs/InviteManager'
import {
  canCreateMoreStaff,
  getStaffMembershipLabel,
} from '@/lib/staffs/presentation'
import { staffsPageFixtures } from '@/lib/e2e/staffs-page-fixtures'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { isPlanAtLeast } from '@/lib/subscription-plan'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type StaffsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
    shift_from?: string
    shift_to?: string
    shift_month?: string
    auto_generate_mode?: string
    auto_generate_count?: string
    auto_generate_applied?: string
    auto_generate_created?: string
    auto_generate_updated?: string
    auto_generate_deleted?: string
    auto_generate_skipped_manual?: string
    auto_generate_policy_violations?: string
    auto_generate_run_id?: string
    auto_generate_strategy?: string
    auto_generate_total_score?: string
    auto_generate_alternatives_count?: string
    attendance_from?: string
    attendance_to?: string
    attendance_staff_id?: string
    attendance_month?: string
    history_from?: string
    history_to?: string
  }>
}

type ActiveTab = 'list' | 'shift' | 'shift-list' | 'shift-settings' | 'shift-history' | 'attendance-punch' | 'attendance-records'

const TIMEZONE_OPTIONS = [
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Australia/Sydney',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
] as const

function resolveActiveTab(value: string | undefined): ActiveTab {
  if (value === 'shift' || value === 'shift-list' || value === 'shift-settings' || value === 'shift-history') return value
  if (value === 'attendance-punch') return 'attendance-punch'
  if (value === 'attendance-records') return 'attendance-records'
  return 'list'
}

function formatIsoDateTime(iso: string | null | undefined) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTimeJst(iso: string | null | undefined) {
  if (!iso) return '--:--'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatShiftSourceType(sourceType: string | null | undefined) {
  if (sourceType === 'auto') return '自動生成'
  if (sourceType === 'nomination_sync') return '指名同期'
  return '手動'
}

function formatLeaveRequestType(requestType: string | null | undefined) {
  if (requestType === 'paid_leave') return '有休'
  if (requestType === 'half_leave_am') return '半休(午前)'
  if (requestType === 'half_leave_pm') return '半休(午後)'
  if (requestType === 'special_leave') return '特休'
  if (requestType === 'absence') return '欠勤'
  return requestType ?? '-'
}

function formatShiftHistoryAction(actionType: string | null | undefined) {
  if (actionType === 'created') return '作成'
  if (actionType === 'updated') return '更新'
  if (actionType === 'deleted') return '削除'
  if (actionType === 'skipped_manual') return '手動保護'
  if (actionType === 'policy_violation') return '制約警告'
  return actionType ?? '-'
}

function formatShiftStrategyLabel(strategy: string | null | undefined) {
  if (strategy === 'optimized') return '最適化'
  if (strategy === 'rule_based') return 'ルールベース'
  return '-'
}

function formatScheduleFrequencyLabel(value: string | null | undefined) {
  if (value === 'daily') return '毎日'
  if (value === 'weekly') return '毎週'
  return value ?? '-'
}

function isMissingRelationErrorMessage(message: string | null | undefined, relationName: string) {
  return `${message ?? ''}`.includes(relationName)
}

function coerceSearchParam(value: unknown) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const last = value[value.length - 1]
    return typeof last === 'string' ? last : ''
  }
  return ''
}

function parseShiftMonth(value: unknown, fallbackDateKey: string) {
  const candidate = coerceSearchParam(value).trim()
  if (/^\d{4}-\d{2}$/.test(candidate)) return candidate
  return fallbackDateKey.slice(0, 7)
}

function parseDateKey(value: unknown) {
  const candidate = coerceSearchParam(value).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null
}

function formatDateWithWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(date)
  return `${dateKey}（${weekday}）`
}

function weekdayFromDateKeyJst(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.getUTCDay()
}

function shiftMonthKey(monthKey: string, offset: number) {
  const matched = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!matched) return monthKey
  const year = Number(matched[1])
  const month = Number(matched[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return monthKey
  const serial = year * 12 + (month - 1) + offset
  const nextYear = Math.floor(serial / 12)
  const nextMonth = (serial % 12) + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function StaffsPage({ searchParams }: StaffsPageProps) {
  const resolvedSearchParams = await searchParams
  const requestedTab = resolveActiveTab(resolvedSearchParams?.tab)
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = '/staffs?tab=list'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: staffsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any
  const planState = isPlaywrightE2E
    ? { planCode: 'light', hotelOptionEnabled: false, notificationOptionEnabled: false }
    : await fetchStorePlanOptionState({
        supabase: asStorePlanOptionsClient(db),
        storeId,
      })
  const isStandardOrHigher = isPlaywrightE2E ? false : isPlanAtLeast(planState.planCode, 'standard')
  const isProPlan = isPlaywrightE2E ? false : isPlanAtLeast(planState.planCode, 'pro')
  const isLightPlan = isPlaywrightE2E ? staffsPageFixtures.isLightPlan : !isStandardOrHigher
  const currentUser = isPlaywrightE2E ? { id: 'user-001' } : (await db.auth.getUser()).data.user
  const data = isPlaywrightE2E
    ? staffsPageFixtures.staffs
    : (
        await db
          .from('staffs')
          .select('id, full_name, email, user_id')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data
  const staffs = data ?? []
  const canCreateStaff = canCreateMoreStaff({ isLightPlan, staffCount: staffs.length })
  const selfMembership = isPlaywrightE2E
    ? staffsPageFixtures.memberships[0]
    : currentUser
      ? (
          await db
            .from('store_memberships')
            .select('id, user_id, role')
            .eq('store_id', storeId)
            .eq('user_id', currentUser.id)
            .eq('is_active', true)
            .maybeSingle()
        ).data
      : null
  const currentMembership = selfMembership
  const canManageRoles = isPlaywrightE2E
    ? staffsPageFixtures.canManageRoles
    : currentMembership?.role === 'owner' && isStandardOrHigher
  const admin = canManageRoles ? createAdminClient() : null
  const memberships =
    isPlaywrightE2E
      ? staffsPageFixtures.memberships
      : canManageRoles && admin
        ? (
            await admin
              .from('store_memberships')
              .select('id, user_id, role')
              .eq('store_id', storeId)
              .eq('is_active', true)
          ).data
        : (currentMembership
            ? [currentMembership]
            : ([] as { id: string; user_id: string; role: 'owner' | 'admin' | 'staff' }[]))
  const attendanceMemberships =
    requestedTab === 'attendance-punch' || requestedTab === 'attendance-records'
      ? isPlaywrightE2E
        ? staffsPageFixtures.memberships
        : (
            await (admin ?? createAdminClient() ?? anyDb)
              .from('store_memberships')
              .select('user_id, role')
              .eq('store_id', storeId)
              .eq('is_active', true)
          ).data ?? []
      : []
  const attendanceRoleByUserId = new Map(
    (
      attendanceMemberships as Array<{
        user_id: string
        role: 'owner' | 'admin' | 'staff'
      }>
    ).map((membership) => [membership.user_id, membership.role])
  )
  const membershipByUserId = new Map((memberships ?? []).map((m) => [m.user_id, m]))
  const canUseShiftFeatures = isPlaywrightE2E ? true : isStandardOrHigher
  const canManageShifts = canUseShiftFeatures && (isPlaywrightE2E
    ? true
    : currentMembership?.role === 'owner' || currentMembership?.role === 'admin')
  const activeTab =
    !canUseShiftFeatures &&
    (requestedTab === 'shift' || requestedTab === 'shift-list' || requestedTab === 'shift-settings' || requestedTab === 'shift-history')
      ? 'list'
      : !canManageShifts && (requestedTab === 'shift' || requestedTab === 'shift-settings' || requestedTab === 'shift-history')
      ? 'list'
      : requestedTab
  const isCreateModalOpen =
    activeTab === 'list' && (resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new')

  function getMembershipLabel(userId: string | null) {
    return getStaffMembershipLabel({
      userId,
      canManageRoles,
      roleByUserId: new Map(Array.from(membershipByUserId.entries()).map(([id, membership]) => [id, membership.role])),
    })
  }

  const editStaff =
    !editId
      ? null
      : isPlaywrightE2E
        ? staffsPageFixtures.staffs.find((staff) => staff.id === editId) ?? null
        : (
            await db
              .from('staffs')
              .select('id, full_name, email, user_id')
              .eq('id', editId)
              .eq('store_id', storeId)
              .single()
          ).data

  const shiftRangeSettings =
    !isPlaywrightE2E && (activeTab === 'shift' || activeTab === 'shift-settings')
      ? (
          await anyDb
            .from('store_shift_settings')
            .select('auto_shift_horizon_days, shift_optimization_enabled, scheduled_auto_run_enabled')
            .eq('store_id', storeId)
            .maybeSingle()
        ).data
      : null
  const configuredShiftHorizonDays =
    Number((shiftRangeSettings as { auto_shift_horizon_days?: number } | null)?.auto_shift_horizon_days ?? 14)
  const safeShiftHorizonDays = Number.isFinite(configuredShiftHorizonDays)
    ? Math.min(90, Math.max(1, Math.trunc(configuredShiftHorizonDays)))
    : 14
  const isShiftOptimizationEnabled = Boolean(
    (shiftRangeSettings as { shift_optimization_enabled?: boolean } | null)?.shift_optimization_enabled ?? false
  )
  const isScheduledAutoRunEnabled = Boolean(
    (shiftRangeSettings as { scheduled_auto_run_enabled?: boolean } | null)?.scheduled_auto_run_enabled ?? false
  )
  const todayDate = new Date()
  const shiftEndDate = new Date(todayDate)
  shiftEndDate.setDate(shiftEndDate.getDate() + safeShiftHorizonDays - 1)
  const todayJst = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(todayDate)
  const configuredShiftFrom = parseDateKey(resolvedSearchParams?.shift_from)
  const configuredShiftTo = parseDateKey(resolvedSearchParams?.shift_to)
  const defaultShiftTo = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shiftEndDate)
  const shiftFrom = configuredShiftFrom ?? todayJst
  const shiftTo = configuredShiftTo ?? defaultShiftTo
  const shiftMonth = parseShiftMonth(resolvedSearchParams?.shift_month, todayJst)
  const shiftMonthStart = `${shiftMonth}-01`
  const shiftMonthNext = shiftMonthKey(shiftMonth, 1)
  const shiftMonthEndDate = new Date(`${shiftMonthNext}-01T00:00:00+09:00`)
  shiftMonthEndDate.setUTCDate(shiftMonthEndDate.getUTCDate() - 1)
  const shiftMonthEnd = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shiftMonthEndDate)
  const shiftPrevMonth = shiftMonthKey(shiftMonth, -1)
  const shiftNextMonth = shiftMonthKey(shiftMonth, 1)
  const shouldLoadShiftRows = activeTab === 'shift' || activeTab === 'shift-list'
  const shiftRangeFrom = activeTab === 'shift-list' ? shiftMonthStart : shiftFrom
  const shiftRangeTo = activeTab === 'shift-list' ? shiftMonthEnd : shiftTo
  const autoGenerateMode = resolvedSearchParams?.auto_generate_mode ?? ''
  const autoGenerateCount = Number(resolvedSearchParams?.auto_generate_count ?? '0')
  const autoGenerateApplied = Number(resolvedSearchParams?.auto_generate_applied ?? '0')
  const autoGenerateCreated = Number(resolvedSearchParams?.auto_generate_created ?? '0')
  const autoGenerateUpdated = Number(resolvedSearchParams?.auto_generate_updated ?? '0')
  const autoGenerateDeleted = Number(resolvedSearchParams?.auto_generate_deleted ?? '0')
  const autoGenerateSkippedManual = Number(resolvedSearchParams?.auto_generate_skipped_manual ?? '0')
  const autoGeneratePolicyViolations = Number(resolvedSearchParams?.auto_generate_policy_violations ?? '0')
  const autoGenerateRunId = resolvedSearchParams?.auto_generate_run_id ?? ''
  const autoGenerateStrategy = resolvedSearchParams?.auto_generate_strategy ?? 'rule_based'
  const autoGenerateTotalScore = Number(resolvedSearchParams?.auto_generate_total_score ?? '')
  const autoGenerateAlternativesCount = Number(resolvedSearchParams?.auto_generate_alternatives_count ?? '0')
  const parsedAttendanceFrom = parseDateKey(resolvedSearchParams?.attendance_from) ?? todayJst
  const parsedAttendanceTo = parseDateKey(resolvedSearchParams?.attendance_to) ?? shiftTo
  const attendanceFrom = parsedAttendanceFrom <= parsedAttendanceTo ? parsedAttendanceFrom : parsedAttendanceTo
  const attendanceTo = parsedAttendanceFrom <= parsedAttendanceTo ? parsedAttendanceTo : parsedAttendanceFrom
  const attendanceView = activeTab === 'attendance-records' ? 'records' : 'punch'
  const attendanceMonth = parseShiftMonth(resolvedSearchParams?.attendance_month, todayJst)
  const attendanceMonthStart = `${attendanceMonth}-01`
  const attendanceMonthNext = shiftMonthKey(attendanceMonth, 1)
  const attendanceMonthEndDate = new Date(`${attendanceMonthNext}-01T00:00:00+09:00`)
  attendanceMonthEndDate.setUTCDate(attendanceMonthEndDate.getUTCDate() - 1)
  const attendanceMonthEnd = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(attendanceMonthEndDate)
  const attendancePrevMonth = shiftMonthKey(attendanceMonth, -1)
  const attendanceNextMonth = shiftMonthKey(attendanceMonth, 1)
  const historyFrom = parseDateKey(resolvedSearchParams?.history_from) ?? shiftFrom
  const historyTo = parseDateKey(resolvedSearchParams?.history_to) ?? shiftTo

  const shiftRowsRaw =
    shouldLoadShiftRows
      ? isPlaywrightE2E
        ? staffsPageFixtures.shiftPlans
        : (
          await anyDb
            .from('staff_shift_plans')
            .select(
              'id, staff_id, shift_date, start_at, end_at, planned_break_minutes, status, source_type, source_appointment_id, note'
            )
            .eq('store_id', storeId)
            .gte('shift_date', shiftRangeFrom)
            .lte('shift_date', shiftRangeTo)
            .order('shift_date', { ascending: true })
            .order('start_at', { ascending: true })
        ).data ?? []
      : []
  const shiftRows =
    activeTab === 'shift-list'
      ? (shiftRowsRaw as Array<{ status?: string }>).filter((row) => row.status === 'published')
      : shiftRowsRaw

  const shiftAlerts =
    activeTab === 'shift'
      ? isPlaywrightE2E
        ? staffsPageFixtures.shiftAlerts
        : (
          await anyDb
            .from('shift_alerts')
            .select('id, alert_date, alert_type, severity, staff_id, message')
            .eq('store_id', storeId)
            .is('resolved_at', null)
            .order('alert_date', { ascending: true })
            .order('created_at', { ascending: false })
        ).data ?? []
      : []

  const ownStaffId =
    isPlaywrightE2E
      ? staffsPageFixtures.staffs[0]?.id ?? null
      : currentUser
        ? staffs.find((staff) => staff.user_id === currentUser.id)?.id ?? null
        : null
  const attendanceTargetStaffOptions = staffs.filter((staff) => {
    const role = staff.user_id ? attendanceRoleByUserId.get(staff.user_id) : undefined
    if (!canManageShifts) return staff.id === ownStaffId
    if (currentMembership?.role === 'owner') return true
    if (currentMembership?.role === 'admin') {
      if (role === 'owner') return false
      if (role === 'admin' && staff.user_id !== currentUser?.id) return false
      return true
    }
    return staff.id === ownStaffId
  })
  const requestedAttendanceStaffId = (resolvedSearchParams?.attendance_staff_id ?? '').trim()
  const isRequestedAttendanceStaffValid = attendanceTargetStaffOptions.some((staff) => staff.id === requestedAttendanceStaffId)
  const attendanceStaffId = canManageShifts
    ? (isRequestedAttendanceStaffValid ? requestedAttendanceStaffId : (attendanceTargetStaffOptions[0]?.id ?? ''))
    : (ownStaffId ?? '')
  const canPunchAttendance = attendanceStaffId.length > 0
  const attendanceRecordsStaffId = canManageShifts ? attendanceStaffId : (ownStaffId ?? '')
  const attendanceRecordsFrom = activeTab === 'attendance-records' ? attendanceMonthStart : attendanceFrom
  const attendanceRecordsTo = activeTab === 'attendance-records' ? attendanceMonthEnd : attendanceTo

  const attendanceSummaries =
    activeTab === 'attendance-punch' || activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? staffsPageFixtures.attendanceSummaries
        : (
            await (canManageShifts
              ? anyDb
                  .from('attendance_daily_summaries')
                  .select(
                    'id, staff_id, business_date, clock_in_at, clock_out_at, break_minutes, worked_minutes, status, flags, updated_at'
                  )
                  .eq('store_id', storeId)
                  .eq('staff_id', attendanceRecordsStaffId || '__none__')
                  .gte('business_date', attendanceRecordsFrom)
                  .lte('business_date', attendanceRecordsTo)
                  .order('business_date', { ascending: true })
                  .order('updated_at', { ascending: false })
              : anyDb
                  .from('attendance_daily_summaries')
                  .select(
                    'id, staff_id, business_date, clock_in_at, clock_out_at, break_minutes, worked_minutes, status, flags, updated_at'
                  )
                  .eq('store_id', storeId)
                  .eq('staff_id', ownStaffId ?? '__none__')
                  .gte('business_date', attendanceRecordsFrom)
                  .lte('business_date', attendanceRecordsTo)
                  .order('business_date', { ascending: true })
                  .order('updated_at', { ascending: false })
            ).then((result: { data: unknown[] | null; error: { message: string } | null }) => (result.error ? [] : (result.data ?? [])))
          )
      : []

  const attendanceEvents =
    activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? staffsPageFixtures.attendanceEvents
        : (
            await anyDb
              .from('attendance_events')
              .select(
                'business_date, event_type, occurred_at, location_lat, location_lng, location_accuracy_meters, location_captured_at, location_is_within_radius'
              )
              .eq('store_id', storeId)
              .eq('staff_id', attendanceRecordsStaffId || '__none__')
              .gte('business_date', attendanceMonthStart)
              .lte('business_date', attendanceMonthEnd)
              .order('occurred_at', { ascending: true })
          ).data ?? []
      : []

  const attendanceRequests =
    activeTab === 'attendance-punch' || activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? staffsPageFixtures.attendanceRequests
        : (
            await (canManageShifts
              ? anyDb
                  .from('attendance_adjustment_requests')
                  .select(
                    'id, staff_id, business_date, requested_payload, reason, status, reviewed_by_user_id, reviewed_at, created_at'
                  )
                  .eq('store_id', storeId)
                  .order('created_at', { ascending: false })
              : anyDb
                  .from('attendance_adjustment_requests')
                  .select(
                    'id, staff_id, business_date, requested_payload, reason, status, reviewed_by_user_id, reviewed_at, created_at'
                  )
                  .eq('store_id', storeId)
                  .eq('staff_id', ownStaffId ?? '__none__')
                  .order('created_at', { ascending: false })
            ).data ?? []
          )
      : []

  const attendanceLeaveRequests =
    activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? []
        : (
            await (canManageShifts
              ? anyDb
                  .from('attendance_leave_requests')
                  .select('id, staff_id, target_date, request_type, reason, status, reviewed_by_user_id, reviewed_at, created_at')
                  .eq('store_id', storeId)
                  .eq('staff_id', attendanceRecordsStaffId || '__none__')
                  .order('created_at', { ascending: false })
              : anyDb
                  .from('attendance_leave_requests')
                  .select('id, staff_id, target_date, request_type, reason, status, reviewed_by_user_id, reviewed_at, created_at')
                  .eq('store_id', storeId)
                  .eq('staff_id', ownStaffId ?? '__none__')
                  .order('created_at', { ascending: false })
            ).data ?? []
          )
      : []

  const leaveBalances =
    activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? []
        : (
            await anyDb
              .from('staff_leave_balances')
              .select('id, leave_type, granted_days, used_days, remaining_days, effective_from, effective_to')
              .eq('store_id', storeId)
              .eq('staff_id', attendanceRecordsStaffId || '__none__')
              .order('effective_from', { ascending: false })
          ).data ?? []
      : []

  const monthlyClosing =
    activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? null
        : (
            await anyDb
              .from('attendance_monthly_closings')
              .select('id, target_month, status, closed_at, reopened_at')
              .eq('store_id', storeId)
              .eq('target_month', attendanceMonth)
              .maybeSingle()
          ).data
      : null

  const attendanceAlerts =
    activeTab === 'attendance-records'
      ? isPlaywrightE2E
        ? []
        : (
            await anyDb
              .from('attendance_alerts')
              .select('id, business_date, alert_type, severity, message, resolved_at')
              .eq('store_id', storeId)
              .eq('staff_id', attendanceRecordsStaffId || '__none__')
              .gte('business_date', attendanceMonthStart)
              .lte('business_date', attendanceMonthEnd)
              .order('business_date', { ascending: true })
            ).data ?? []
      : []
  const attendanceMonthClosed = monthlyClosing?.status === 'closed'

  let shiftHistoryError: string | null = null
  let shiftHistoryRuns: Array<{
    id: string
    created_at: string
    requested_by_user_id: string | null
    from_date: string
    to_date: string
    mode: string
    summary: { [key: string]: unknown } | null
  }> = []
  let shiftHistoryItems: Array<{
    id: string
    run_id: string
    shift_date: string
    staff_id: string | null
    action_type: string
    message: string | null
    created_at: string
  }> = []
  if (activeTab === 'shift-history' && !isPlaywrightE2E) {
    const runsResult = await anyDb
      .from('shift_auto_generate_runs')
      .select('id, created_at, requested_by_user_id, from_date, to_date, mode, summary')
      .eq('store_id', storeId)
      .lte('from_date', historyTo)
      .gte('to_date', historyFrom)
      .order('created_at', { ascending: false })
      .limit(50)
    if (runsResult.error) {
      if (!isMissingRelationErrorMessage(runsResult.error.message, 'shift_auto_generate_runs')) {
        shiftHistoryError = runsResult.error.message
      }
    } else {
      shiftHistoryRuns = (runsResult.data ?? []) as typeof shiftHistoryRuns
    }

    const itemsResult = await anyDb
      .from('shift_auto_generate_run_items')
      .select('id, run_id, shift_date, staff_id, action_type, message, created_at')
      .eq('store_id', storeId)
      .gte('shift_date', historyFrom)
      .lte('shift_date', historyTo)
      .order('created_at', { ascending: false })
      .limit(200)
    if (itemsResult.error) {
      if (!isMissingRelationErrorMessage(itemsResult.error.message, 'shift_auto_generate_run_items')) {
        shiftHistoryError = shiftHistoryError ?? itemsResult.error.message
      }
    } else {
      shiftHistoryItems = (itemsResult.data ?? []) as typeof shiftHistoryItems
    }
  }

  const shiftSettings =
    activeTab === 'shift-settings' && !isPlaywrightE2E
      ? (
          await anyDb
            .from('store_shift_settings')
            .select('*')
            .eq('store_id', storeId)
            .maybeSingle()
        ).data
      : null

  const shiftOptimizationProfile =
    activeTab === 'shift-settings' && !isPlaywrightE2E
      ? (
          await anyDb
            .from('shift_optimization_profiles')
            .select('fairness_weight, preferred_shift_weight, reservation_coverage_weight, workload_health_weight')
            .eq('store_id', storeId)
            .maybeSingle()
        ).data
      : null

  const shiftScheduledJobs =
    activeTab === 'shift-settings' && !isPlaywrightE2E && isProPlan
      ? (
          await anyDb
            .from('shift_scheduled_jobs')
            .select('id, is_active, frequency, run_at_local_time, run_weekday, target_horizon_days, mode, updated_at')
            .eq('store_id', storeId)
            .order('updated_at', { ascending: false })
        ).data ?? []
      : []

  const closedRules =
    (activeTab === 'shift-settings' || activeTab === 'shift-list') && !isPlaywrightE2E
      ? (
          await anyDb
            .from('store_closed_rules')
            .select('rule_type, weekday, closed_date')
            .eq('store_id', storeId)
            .eq('is_active', true)
            .order('rule_type', { ascending: true })
        ).data ?? []
      : []

  const staffWorkRules =
    activeTab === 'shift-settings' && !isPlaywrightE2E
      ? (
          await anyDb
            .from('staff_work_rules')
            .select('id, staff_id, employment_type, weekly_max_minutes, max_consecutive_days, can_be_nominated, preferred_shift_minutes')
            .eq('store_id', storeId)
        ).data ?? []
      : []

  const workRuleSlots =
    activeTab === 'shift-settings' && !isPlaywrightE2E
      ? (
          await anyDb
            .from('staff_work_rule_slots')
            .select('staff_work_rule_id, weekday, start_time, end_time')
            .eq('store_id', storeId)
            .order('weekday', { ascending: true })
            .order('start_time', { ascending: true })
        ).data ?? []
      : []

  const staffDayOffRequests =
    activeTab === 'shift-settings' && !isPlaywrightE2E
      ? (
          await anyDb
            .from('staff_day_off_requests')
            .select('staff_id, day_off_date, status')
            .eq('store_id', storeId)
            .eq('status', 'approved')
            .order('day_off_date', { ascending: true })
        ).data ?? []
      : []

  const staffNameById = new Map((staffs ?? []).map((staff) => [staff.id, staff.full_name]))
  const staffNameByUserId = new Map(
    (staffs ?? [])
      .filter((staff) => typeof staff.user_id === 'string' && staff.user_id.length > 0)
      .map((staff) => [staff.user_id as string, staff.full_name])
  )
  const workRuleByStaffId = new Map(
    (staffWorkRules as Array<{
      id: string
      staff_id: string
      employment_type: string
      weekly_max_minutes: number | null
      max_consecutive_days: number | null
      can_be_nominated: boolean
      preferred_shift_minutes: number | null
    }>).map((rule) => [rule.staff_id, rule])
  )
  const slotTextByRuleId = new Map<string, string>()
  ;(workRuleSlots as Array<{ staff_work_rule_id: string; weekday: number; start_time: string; end_time: string }>).forEach((slot) => {
    const line = `${slot.weekday}:${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`
    const prev = slotTextByRuleId.get(slot.staff_work_rule_id)
    slotTextByRuleId.set(slot.staff_work_rule_id, prev ? `${prev}\n${line}` : line)
  })
  const dayOffTextByStaffId = new Map<string, string>()
  ;(staffDayOffRequests as Array<{ staff_id: string; day_off_date: string }>).forEach((dayOff) => {
    const prev = dayOffTextByStaffId.get(dayOff.staff_id)
    dayOffTextByStaffId.set(dayOff.staff_id, prev ? `${prev}\n${dayOff.day_off_date}` : dayOff.day_off_date)
  })
  const optimizationWeights = {
    fairness_weight: Number((shiftOptimizationProfile as { fairness_weight?: number } | null)?.fairness_weight ?? 0.35),
    preferred_shift_weight: Number((shiftOptimizationProfile as { preferred_shift_weight?: number } | null)?.preferred_shift_weight ?? 0.25),
    reservation_coverage_weight: Number(
      (shiftOptimizationProfile as { reservation_coverage_weight?: number } | null)?.reservation_coverage_weight ?? 0.3
    ),
    workload_health_weight: Number((shiftOptimizationProfile as { workload_health_weight?: number } | null)?.workload_health_weight ?? 0.1),
  }
  const attendanceSummaryByDate = new Map(
    (attendanceSummaries as Array<{
      business_date: string
      clock_in_at: string | null
      clock_out_at: string | null
      break_minutes: number
      worked_minutes: number
      status: string
    }>).map((summary) => [summary.business_date, summary])
  )
  const breakStartByDate = new Map<string, string>()
  const breakEndByDate = new Map<string, string>()
  const locationByDate = new Map<string, string>()
  ;(attendanceEvents as Array<{
    business_date: string
    event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
    occurred_at: string
    location_lat: number | null
    location_lng: number | null
    location_accuracy_meters: number | null
    location_captured_at: string | null
    location_is_within_radius: boolean | null
  }>).forEach((event) => {
    if (event.event_type === 'break_start') {
      const prev = breakStartByDate.get(event.business_date)
      if (!prev || event.occurred_at < prev) {
        breakStartByDate.set(event.business_date, event.occurred_at)
      }
    } else if (event.event_type === 'break_end') {
      const prev = breakEndByDate.get(event.business_date)
      if (!prev || event.occurred_at > prev) {
        breakEndByDate.set(event.business_date, event.occurred_at)
      }
    }
    if (
      event.location_lat !== null &&
      event.location_lng !== null &&
      Number.isFinite(Number(event.location_lat)) &&
      Number.isFinite(Number(event.location_lng))
    ) {
      const withinLabel =
        event.location_is_within_radius === null
          ? ''
          : event.location_is_within_radius
            ? ' / 判定: 範囲内'
            : ' / 判定: 範囲外'
      const accuracyLabel =
        event.location_accuracy_meters !== null && Number.isFinite(Number(event.location_accuracy_meters))
          ? ` / 精度±${Math.round(Number(event.location_accuracy_meters))}m`
          : ''
      locationByDate.set(
        event.business_date,
        `緯度 ${Number(event.location_lat).toFixed(5)} / 経度 ${Number(event.location_lng).toFixed(5)}${accuracyLabel}${withinLabel}`
      )
    }
  })
  const attendanceRecordRows: Array<{
    date: string
    weekday: string
    clockInAt: string | null
    clockOutAt: string | null
    breakStartAt: string | null
    breakEndAt: string | null
    breakMinutes: number
    workedMinutes: number
    status: string
    locationDetail: string | null
  }> = []
  if (activeTab === 'attendance-records') {
    for (let date = new Date(`${attendanceMonthStart}T00:00:00+09:00`); date <= attendanceMonthEndDate; date.setUTCDate(date.getUTCDate() + 1)) {
      const dateKey = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
      const summary = attendanceSummaryByDate.get(dateKey)
      const weekday = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        weekday: 'short',
      }).format(date)
      attendanceRecordRows.push({
        date: dateKey,
        weekday,
        clockInAt: summary?.clock_in_at ?? null,
        clockOutAt: summary?.clock_out_at ?? null,
        breakStartAt: breakStartByDate.get(dateKey) ?? null,
        breakEndAt: breakEndByDate.get(dateKey) ?? null,
        breakMinutes: summary?.break_minutes ?? 0,
        workedMinutes: summary?.worked_minutes ?? 0,
        status: summary?.status ?? '-',
        locationDetail: locationByDate.get(dateKey) ?? null,
      })
    }
  }

  const timelineShiftRows = (shiftRows as Array<{
    id: string
    staff_id: string
    shift_date: string
    start_at: string
    end_at: string
    planned_break_minutes: number
    status: 'draft' | 'published'
    source_type: string
    note: string | null
  }>).map((row) => row)
  const validTimelineShifts = timelineShiftRows.filter(
    (row) => {
      const start = new Date(row.start_at).getTime()
      const end = new Date(row.end_at).getTime()
      return Number.isFinite(start) && Number.isFinite(end) && end > start
    }
  ) as Array<{
    id: string
    staff_id: string
    shift_date: string
    start_at: string
    end_at: string
    planned_break_minutes: number
    status: 'draft' | 'published'
    source_type: string
    note: string | null
  }>
  const timelineByDate = new Map<
    string,
    Array<{
      id: string
      staff_id: string
      shift_date: string
      start_at: string
      end_at: string
      planned_break_minutes: number
      status: 'draft' | 'published'
      source_type: string
      note: string | null
    }>
  >()
  validTimelineShifts.forEach((shift) => {
    const list = timelineByDate.get(shift.shift_date)
    if (list) {
      list.push(shift)
    } else {
      timelineByDate.set(shift.shift_date, [shift])
    }
  })
  const timelineDays = Array.from(timelineByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const monthShiftRows = (shiftRows as Array<{
    id: string
    staff_id: string
    shift_date: string
    start_at: string
    end_at: string
    planned_break_minutes: number
    status: 'draft' | 'published'
    source_type: string
  }>).map((row) => row)
  const monthShiftsByDate = new Map<string, typeof monthShiftRows>()
  monthShiftRows.forEach((row) => {
    const prev = monthShiftsByDate.get(row.shift_date)
    if (prev) prev.push(row)
    else monthShiftsByDate.set(row.shift_date, [row])
  })
  for (const [dateKey, rows] of monthShiftsByDate.entries()) {
    rows.sort((a, b) => a.start_at.localeCompare(b.start_at))
    monthShiftsByDate.set(dateKey, rows)
  }
  const monthStartWeekday = weekdayFromDateKeyJst(shiftMonthStart) ?? 0
  const monthDates: string[] = []
  for (let day = 1; day <= Number(shiftMonthEnd.slice(8, 10)); day += 1) {
    monthDates.push(`${shiftMonth}-${String(day).padStart(2, '0')}`)
  }
  const monthCalendarCells = [
    ...Array.from({ length: monthStartWeekday }, () => null),
    ...monthDates,
  ] as Array<string | null>
  while (monthCalendarCells.length % 7 !== 0) monthCalendarCells.push(null)
  const closedWeekdaySet = new Set<number>(
    (closedRules as Array<{ rule_type: string; weekday: number | null }>)
      .filter((row) => row.rule_type === 'weekday' && typeof row.weekday === 'number')
      .map((row) => row.weekday as number)
  )
  const closedDateSet = new Set<string>(
    (closedRules as Array<{ rule_type: string; closed_date: string | null }>)
      .filter((row) => row.rule_type === 'date' && typeof row.closed_date === 'string')
      .map((row) => row.closed_date as string)
  )
  function isClosedDay(dateKey: string) {
    if (closedDateSet.has(dateKey)) return true
    const weekday = weekdayFromDateKeyJst(dateKey)
    if (weekday === null) return false
    return closedWeekdaySet.has(weekday)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">スタッフ管理</h1>
        {isLightPlan ? (
          <p className="text-sm text-amber-700">
            ライトプランではスタッフは3人まで登録可能です。権限変更はスタンダード以上で利用できます。
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2">
          <Link
            href="/staffs?tab=list"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              activeTab === 'list' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            スタッフ一覧
          </Link>
          {canManageShifts ? (
            <Link
              href="/staffs?tab=shift-settings"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'shift-settings' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              シフト設定
            </Link>
          ) : null}
          {canManageShifts ? (
            <Link
              href="/staffs?tab=shift"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'shift' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              シフト管理
            </Link>
          ) : null}
          {canUseShiftFeatures ? (
            <Link
              href={`/staffs?tab=shift-list&shift_month=${shiftMonth}`}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'shift-list' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              シフト一覧
            </Link>
          ) : null}
          {canManageShifts ? (
            <Link
              href="/staffs?tab=shift-history"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'shift-history' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              シフト変更履歴
            </Link>
          ) : null}
          <Link
            href={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              activeTab === 'attendance-records' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            勤怠管理
          </Link>
        </div>
      </div>

      {activeTab === 'list' ? <InviteManager /> : null}

      {activeTab === 'list' ? (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">スタッフ一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {staffs.length} 件</p>
            {canCreateStaff ? (
              <Link
                href="/staffs?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            ) : (
              <span
                aria-disabled
                className="inline-flex cursor-not-allowed items-center rounded bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-600"
              >
                上限（3人）
              </span>
            )}
          </div>
        </div>
        {staffs.length === 0 ? (
          <p className="text-sm text-gray-500">スタッフがまだ登録されていません。</p>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden" data-testid="staffs-list-mobile">
              {staffs.map((staff) => {
                const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                return (
                <article
                  key={staff.id}
                  className="rounded border border-gray-200 p-3 text-sm text-gray-700"
                  data-testid={`staff-row-${staff.id}`}
                >
                  <p className="truncate font-semibold text-gray-900">{staff.full_name}</p>
                  <p className="truncate text-xs text-gray-500">メール: {staff.email ?? '未登録'}</p>
                  <p className="truncate text-xs text-gray-500">User ID: {staff.user_id ?? '未登録'}</p>
                  <span className="mt-2 inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                    {getMembershipLabel(staff.user_id ?? null)}
                  </span>
                  {canManageRoles && membership ? (
                    <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="mt-2 flex items-center gap-1.5">
                      <select
                        name="role"
                        defaultValue={membership.role}
                        className="h-7 rounded border px-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                      </select>
                      <Button type="submit" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                        権限変更
                      </Button>
                    </form>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/staffs?tab=list&edit=${staff.id}`}
                      className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      編集
                    </Link>
                    <form action={`/api/staffs/${staff.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
                )
              })}
            </div>

            <div className="hidden md:block">
              <table className="min-w-full table-fixed text-sm text-left" data-testid="staffs-list">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">スタッフ</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">権限</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffs.map((staff) => {
                    const membership = staff.user_id ? membershipByUserId.get(staff.user_id) : undefined
                    return (
                    <tr
                      key={staff.id}
                      className="text-gray-700"
                      data-testid={`staff-row-${staff.id}`}
                    >
                      <td className="px-2.5 py-2 align-top">
                        <p className="truncate font-medium text-gray-900">{staff.full_name}</p>
                        <p className="truncate text-xs text-gray-500">{staff.email ?? '未登録'}</p>
                        <p className="truncate text-xs text-gray-500">User ID: {staff.user_id ?? '未登録'}</p>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {getMembershipLabel(staff.user_id ?? null)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canManageRoles && membership ? (
                            <form action={`/api/store-memberships/${membership.id}/role`} method="post" className="flex items-center gap-1.5">
                              <select
                                name="role"
                                defaultValue={membership.role}
                                className="h-7 rounded border px-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none"
                              >
                                <option value="owner">owner</option>
                                <option value="admin">admin</option>
                                <option value="staff">staff</option>
                              </select>
                              <Button type="submit" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                                権限変更
                              </Button>
                            </form>
                          ) : null}
                          <Link
                            href={`/staffs?tab=list&edit=${staff.id}`}
                            className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            編集
                          </Link>
                          <form action={`/api/staffs/${staff.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                              削除
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      ) : null}

      {activeTab === 'shift' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">シフト管理</h2>
            <div className="flex flex-wrap items-center gap-2">
              {canManageShifts ? (
                <>
                  <form action="/api/staff-shifts/sync-nominations" method="post">
                    <input type="hidden" name="from_date" value={shiftFrom} />
                    <input type="hidden" name="to_date" value={shiftTo} />
                    <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                    <Button type="submit" className="border border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700">
                      指名予約と同期
                    </Button>
                  </form>
                  <form action="/api/staff-shifts/auto-generate" method="post">
                    <input type="hidden" name="from_date" value={shiftFrom} />
                    <input type="hidden" name="to_date" value={shiftTo} />
                    <input type="hidden" name="mode" value="apply_draft" />
                    <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                    <div className="flex items-center gap-2">
                      <select
                        name="strategy"
                        defaultValue={isProPlan && isShiftOptimizationEnabled ? 'optimized' : 'rule_based'}
                        className="h-9 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="rule_based">ルールベース</option>
                        <option value="optimized" disabled={!isProPlan || !isShiftOptimizationEnabled}>
                          最適化{!isProPlan ? '（プロ限定）' : !isShiftOptimizationEnabled ? '（設定OFF）' : ''}
                        </option>
                      </select>
                      <Button type="submit" className="border border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700">
                        自動生成（下書き）
                      </Button>
                    </div>
                  </form>
                </>
              ) : null}
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <form action="/staffs" method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="shift" />
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                表示開始日
                <Input type="date" name="shift_from" defaultValue={shiftFrom} className="h-9" />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                表示終了日
                <Input type="date" name="shift_to" defaultValue={shiftTo} className="h-9" />
              </label>
              <Button type="submit" className="inline-flex h-9 items-center justify-center whitespace-nowrap">
                表示更新
              </Button>
            </form>
            {canManageShifts ? (
              <div className="flex flex-wrap items-center gap-2">
                <form action="/api/staff-shifts/bulk" method="post">
                  <input type="hidden" name="action_type" value="publish" />
                  <input type="hidden" name="from_date" value={shiftFrom} />
                  <input type="hidden" name="to_date" value={shiftTo} />
                  <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                  <Button type="submit" className="inline-flex h-9 min-w-[5rem] items-center justify-center whitespace-nowrap border border-blue-700 bg-blue-600 px-3 text-white hover:bg-blue-700">
                    全公開
                  </Button>
                </form>
                <form action="/api/staff-shifts/bulk" method="post">
                  <input type="hidden" name="action_type" value="unpublish" />
                  <input type="hidden" name="from_date" value={shiftFrom} />
                  <input type="hidden" name="to_date" value={shiftTo} />
                  <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                  <Button type="submit" className="inline-flex h-9 min-w-[5rem] items-center justify-center whitespace-nowrap border border-amber-400 bg-amber-100 px-3 text-amber-800 hover:bg-amber-200">
                    全非公開
                  </Button>
                </form>
                <form action="/api/staff-shifts/bulk" method="post">
                  <input type="hidden" name="action_type" value="delete" />
                  <input type="hidden" name="from_date" value={shiftFrom} />
                  <input type="hidden" name="to_date" value={shiftTo} />
                  <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                  <Button type="submit" className="inline-flex h-9 min-w-[5rem] items-center justify-center whitespace-nowrap border border-red-400 bg-red-100 px-3 text-red-800 hover:bg-red-200">
                    全削除
                  </Button>
                </form>
              </div>
            ) : null}
          </div>

          {autoGenerateMode ? (
            <div className="mb-4 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              {autoGenerateMode === 'apply_draft'
                ? `自動生成（${formatShiftStrategyLabel(autoGenerateStrategy)}）を実行しました。候補 ${Number.isFinite(autoGenerateCount) ? autoGenerateCount : 0} 件 / 反映 ${Number.isFinite(autoGenerateApplied) ? autoGenerateApplied : 0} 件（作成 ${Number.isFinite(autoGenerateCreated) ? autoGenerateCreated : 0} / 更新 ${Number.isFinite(autoGenerateUpdated) ? autoGenerateUpdated : 0} / 削除 ${Number.isFinite(autoGenerateDeleted) ? autoGenerateDeleted : 0} / 手動保護 ${Number.isFinite(autoGenerateSkippedManual) ? autoGenerateSkippedManual : 0} / 制約警告 ${Number.isFinite(autoGeneratePolicyViolations) ? autoGeneratePolicyViolations : 0}）${Number.isFinite(autoGenerateTotalScore) ? ` / 総合スコア ${autoGenerateTotalScore}` : ''}${Number.isFinite(autoGenerateAlternativesCount) && autoGenerateAlternativesCount > 0 ? ` / 代替案 ${autoGenerateAlternativesCount} 件` : ''}${autoGenerateRunId ? ` / 実行ID: ${autoGenerateRunId}` : ''}`
                : `自動生成プレビュー結果: ${Number.isFinite(autoGenerateCount) ? autoGenerateCount : 0} 件`}
            </div>
          ) : null}

          {shiftAlerts.length > 0 ? (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">不足警告: {shiftAlerts.length} 件</p>
              <ul className="mt-2 space-y-1">
                {(shiftAlerts as Array<{ id: string; alert_date: string; staff_id: string | null; message: string }>).slice(0, 8).map((alert) => (
                  <li key={alert.id}>
                    {alert.alert_date} / {alert.staff_id ? staffNameById.get(alert.staff_id) ?? alert.staff_id : '未指定'} / {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">未解決のシフト警告はありません。</p>
          )}

          {canManageShifts ? (
            <form action="/api/staff-shifts" method="post" className="mb-6 grid grid-cols-1 gap-2 rounded border border-gray-200 p-3 md:grid-cols-7 dark:border-slate-700 dark:bg-slate-900/40">
              <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                スタッフ
                <select name="staff_id" required className="h-10 w-full rounded border px-2 text-sm">
                  <option value="">スタッフ</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                日付
                <Input type="date" name="shift_date" defaultValue={todayJst} className="h-10" required />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                開始
                <Input type="time" name="start_time" defaultValue="09:00" className="h-10" required />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                終了
                <Input type="time" name="end_time" defaultValue="18:00" className="h-10" required />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                休憩(分)
                <Input type="number" name="planned_break_minutes" min={0} defaultValue={60} className="h-10" />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                メモ
                <Input name="note" placeholder="メモ（任意）" className="h-10" />
              </label>
              <div className="flex items-end">
                <Button type="submit" className="inline-flex h-10 w-full items-center justify-center">シフト追加</Button>
              </div>
            </form>
          ) : null}

          {shiftRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">指定期間のシフトはまだありません。</p>
          ) : (
            <div className="space-y-4">
                {timelineDays.map(([shiftDate, dayShifts]) => (
                  <div key={shiftDate} className="overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-gray-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                      <h3 className="text-sm font-semibold text-slate-900">{formatDateWithWeekday(shiftDate)}</h3>
                      <p className="text-xs text-slate-600">
                        シフト {dayShifts.length} 件
                      </p>
                    </div>

                    <div className="hidden md:block">
                      <div className="grid grid-cols-[170px_140px_80px_150px_250px] border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <div className="border-r border-gray-200 px-3 py-2 dark:border-slate-700">スタッフ</div>
                        <div className="border-r border-gray-200 px-3 py-2 dark:border-slate-700">勤務時間</div>
                        <div className="border-r border-gray-200 px-3 py-2 dark:border-slate-700">休憩(分)</div>
                        <div className="border-r border-gray-200 px-3 py-2 dark:border-slate-700">メモ</div>
                        <div className="px-3 py-2">操作</div>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {dayShifts.map((shift) => (
                          <div key={shift.id} className="grid grid-cols-[170px_140px_80px_150px_250px]">
                            <div className="flex items-center border-r border-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700 dark:text-slate-300">
                              <p className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-slate-100">
                                <span>{staffNameById.get(shift.staff_id) ?? shift.staff_id}</span>
                                <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {formatShiftSourceType(shift.source_type)}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center border-r border-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700 dark:text-slate-300">
                              <p className="font-semibold text-gray-900 dark:text-slate-100">{formatTimeJst(shift.start_at)} - {formatTimeJst(shift.end_at)}</p>
                            </div>
                            <div className="flex items-center border-r border-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:border-slate-700 dark:text-slate-100">
                              {shift.planned_break_minutes}
                            </div>
                            <div className="flex items-center border-r border-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700 dark:text-slate-300">
                              <p className="w-full truncate" title={shift.note ?? ''}>{shift.note ?? '-'}</p>
                            </div>
                            <div className="px-3 py-1.5">
                              {canManageShifts ? (
                                <div className="flex flex-nowrap items-center gap-1">
                                  <details className="relative flex items-center [&[open]]:z-40">
                                    <summary className="inline-flex h-7 min-w-[4.5rem] cursor-pointer list-none items-center justify-center whitespace-nowrap rounded border border-slate-700 bg-slate-600 px-2 text-[11px] leading-none text-white hover:bg-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
                                      時間編集
                                    </summary>
                                    <div className="absolute bottom-8 right-0 z-50 rounded border border-gray-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                                      <form action={`/api/staff-shifts/${shift.id}`} method="post" className="flex items-end gap-1.5">
                                        <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                                        <input type="hidden" name="shift_date" value={shift.shift_date} />
                                        <label className="text-[10px] text-gray-500 dark:text-slate-300">
                                          開始
                                          <input type="time" name="start_time" defaultValue={formatTimeJst(shift.start_at)} className="mt-0.5 block h-7 rounded border border-gray-300 px-1.5 text-[11px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" required />
                                        </label>
                                        <label className="text-[10px] text-gray-500 dark:text-slate-300">
                                          終了
                                          <input type="time" name="end_time" defaultValue={formatTimeJst(shift.end_at)} className="mt-0.5 block h-7 rounded border border-gray-300 px-1.5 text-[11px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" required />
                                        </label>
                                        <Button type="submit" className="h-7 min-w-[3.75rem] whitespace-nowrap border border-slate-300 bg-white px-2 py-0 text-[11px] leading-none text-slate-700 hover:bg-slate-100">
                                          更新
                                        </Button>
                                      </form>
                                    </div>
                                  </details>
                                  {shift.status === 'draft' ? (
                                    <form action={`/api/staff-shifts/${shift.id}/publish`} method="post" className="flex items-center">
                                      <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                                      <Button type="submit" className="h-7 min-w-[3.5rem] whitespace-nowrap border border-blue-700 bg-blue-600 px-2 py-0 text-[11px] leading-none text-white hover:bg-blue-700">
                                        公開
                                      </Button>
                                    </form>
                                  ) : (
                                    <form action={`/api/staff-shifts/${shift.id}`} method="post" className="flex items-center">
                                      <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                                      <input type="hidden" name="status" value="draft" />
                                      <Button type="submit" className="h-7 min-w-[4rem] whitespace-nowrap border border-amber-300 bg-amber-50 px-2 py-0 text-[11px] leading-none text-amber-700 hover:bg-amber-100">
                                        非公開
                                      </Button>
                                    </form>
                                  )}
                                  <form action={`/api/staff-shifts/${shift.id}`} method="post" className="flex items-center">
                                    <input type="hidden" name="_method" value="delete" />
                                    <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                                    <Button type="submit" className="h-7 min-w-[3.5rem] whitespace-nowrap border border-red-300 bg-red-50 px-2 py-0 text-[11px] leading-none text-red-700 hover:bg-red-100">
                                      削除
                                    </Button>
                                  </form>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">閲覧のみ</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100 md:hidden">
                      {dayShifts.map((shift) => (
                        <div key={`mobile-${shift.id}`} className="space-y-2 px-3 py-2">
                          <div className="flex items-center justify-between text-xs">
                            <p className="font-semibold text-gray-900">{staffNameById.get(shift.staff_id) ?? shift.staff_id}</p>
                            <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-600">
                              {formatShiftSourceType(shift.source_type)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{formatTimeJst(shift.start_at)} - {formatTimeJst(shift.end_at)}</p>
                          <p className="text-xs text-gray-600">休憩: {shift.planned_break_minutes}分</p>
                          {shift.note ? <p className="text-xs text-gray-500">メモ: {shift.note}</p> : null}
                          {canManageShifts ? (
                            <form action={`/api/staff-shifts/${shift.id}`} method="post" className="space-y-1.5">
                              <input type="hidden" name="redirect_to" value={`/staffs?tab=shift&shift_from=${shiftFrom}&shift_to=${shiftTo}`} />
                              <input type="hidden" name="shift_date" value={shift.shift_date} />
                              <div className="grid grid-cols-2 items-end gap-1.5">
                                <label className="text-[10px] text-gray-500">
                                  開始
                                  <input type="time" name="start_time" defaultValue={formatTimeJst(shift.start_at)} className="mt-0.5 block h-7 w-full rounded border border-gray-300 px-1.5 text-[11px]" required />
                                </label>
                                <label className="text-[10px] text-gray-500">
                                  終了
                                  <input type="time" name="end_time" defaultValue={formatTimeJst(shift.end_at)} className="mt-0.5 block h-7 w-full rounded border border-gray-300 px-1.5 text-[11px]" required />
                                </label>
                                <Button type="submit" className="col-span-2 inline-flex h-7 w-full items-center justify-center whitespace-nowrap border border-slate-300 bg-white px-2 py-0 text-[11px] leading-none text-slate-700">
                                  時間更新
                                </Button>
                              </div>
                              <div className="flex flex-nowrap items-center gap-1">
                                {shift.status === 'draft' ? (
                                  <Button
                                    type="submit"
                                    formAction={`/api/staff-shifts/${shift.id}/publish`}
                                    formMethod="post"
                                    className="inline-flex h-7 min-w-[3.5rem] items-center justify-center whitespace-nowrap border border-blue-700 bg-blue-600 px-2 py-0 text-[11px] leading-none text-white"
                                  >
                                    公開
                                  </Button>
                                ) : (
                                  <Button
                                    type="submit"
                                    name="status"
                                    value="draft"
                                    className="inline-flex h-7 min-w-[4rem] items-center justify-center whitespace-nowrap border border-amber-300 bg-amber-50 px-2 py-0 text-[11px] leading-none text-amber-700"
                                  >
                                    非公開
                                  </Button>
                                )}
                                <Button
                                  type="submit"
                                  name="_method"
                                  value="delete"
                                  className="inline-flex h-7 min-w-[3.5rem] items-center justify-center whitespace-nowrap border border-red-300 bg-red-50 px-2 py-0 text-[11px] leading-none text-red-700"
                                >
                                  削除
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <span className="text-xs text-gray-400">閲覧のみ</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'shift-list' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">シフト一覧</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/staffs?tab=shift-list&shift_month=${shiftPrevMonth}`}
                className="inline-flex h-9 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded border border-blue-700 bg-blue-600 px-3 text-sm font-semibold leading-none text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
              >
                前へ
              </Link>
              <form action="/staffs" method="get" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="shift-list" />
                <Input
                  key={shiftMonth}
                  type="month"
                  name="shift_month"
                  defaultValue={shiftMonth}
                  className="h-9 w-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <Button type="submit" className="inline-flex h-9 min-w-[4.5rem] items-center justify-center whitespace-nowrap border border-blue-700 bg-blue-600 px-3 text-sm font-semibold leading-none text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400">
                  表示
                </Button>
              </form>
              <Link
                href={`/staffs?tab=shift-list&shift_month=${shiftNextMonth}`}
                className="inline-flex h-9 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded border border-blue-700 bg-blue-600 px-3 text-sm font-semibold leading-none text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
              >
                次へ
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {['日', '月', '火', '水', '木', '金', '土'].map((label) => (
              <div key={label} className="hidden rounded border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:block">
                {label}
              </div>
            ))}
            {monthCalendarCells.map((dateKey, idx) =>
              dateKey ? (
                <section
                  key={dateKey}
                  className={`min-h-36 rounded border p-2 shadow-sm ${
                    isClosedDay(dateKey)
                      ? 'border-rose-200 bg-rose-50 dark:border-rose-700/60 dark:bg-rose-950/30'
                      : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <header className="mb-1 flex items-center justify-between border-b border-gray-100 pb-1">
                    <p
                      className={`text-sm font-semibold ${
                        isClosedDay(dateKey) ? 'text-red-700' : 'text-gray-900'
                      }`}
                    >
                      {Number(dateKey.slice(8, 10))}日
                    </p>
                    <p
                      className={`text-[11px] font-medium ${
                        isClosedDay(dateKey) ? 'text-red-600' : 'text-gray-600'
                      }`}
                    >
                      件数 {monthShiftsByDate.get(dateKey)?.length ?? 0}
                    </p>
                  </header>
                  <div className="space-y-1.5">
                    {(monthShiftsByDate.get(dateKey) ?? []).map((shift) => (
                      <div key={`month-${shift.id}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-600 dark:bg-slate-800">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{staffNameById.get(shift.staff_id) ?? shift.staff_id}</p>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          {formatTimeJst(shift.start_at)} - {formatTimeJst(shift.end_at)}（休憩 {shift.planned_break_minutes}分）
                        </p>
                      </div>
                    ))}
                    {(monthShiftsByDate.get(dateKey) ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{isClosedDay(dateKey) ? '定休日' : 'シフトなし'}</p>
                    ) : null}
                  </div>
                </section>
              ) : (
                <div key={`blank-${idx}`} className="hidden rounded border border-dashed border-gray-200 bg-gray-50/40 dark:border-slate-700 dark:bg-slate-900/40 md:block" />
              )
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'shift-settings' ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">シフト設定</h2>
          {canManageShifts ? (
            <>
              <form action="/api/staff-shifts/settings" method="post" className="mb-6 grid grid-cols-1 gap-3 rounded border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <input type="hidden" name="redirect_to" value="/staffs?tab=shift-settings" />
                <div className="space-y-2 rounded border border-gray-100 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-slate-300">タイムゾーン</span>
                    <select name="timezone" defaultValue={(shiftSettings as { timezone?: string } | null)?.timezone ?? 'Asia/Tokyo'} className="h-10 w-full rounded border px-2 text-sm">
                      {TIMEZONE_OPTIONS.map((timezone) => (
                        <option key={timezone} value={timezone}>{timezone}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-slate-300">生成期間（日）</span>
                    <Input type="number" min={1} max={90} name="auto_shift_horizon_days" defaultValue={String((shiftSettings as { auto_shift_horizon_days?: number } | null)?.auto_shift_horizon_days ?? 14)} className="h-10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-slate-300">遅刻猶予（分）</span>
                    <Input type="number" min={0} name="late_grace_minutes" defaultValue={String((shiftSettings as { late_grace_minutes?: number } | null)?.late_grace_minutes ?? 10)} className="h-10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-slate-300">早退猶予（分）</span>
                    <Input type="number" min={0} name="early_leave_grace_minutes" defaultValue={String((shiftSettings as { early_leave_grace_minutes?: number } | null)?.early_leave_grace_minutes ?? 10)} className="h-10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-slate-300">生成優先</span>
                    <select name="policy_priority" defaultValue={(shiftSettings as { policy_priority?: string } | null)?.policy_priority ?? 'nomination_first'} className="h-10 w-full rounded border px-2 text-sm">
                      <option value="nomination_first">指名予約優先</option>
                      <option value="cost_first">コスト優先</option>
                      <option value="fairness_first">公平性優先</option>
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" name="auto_shift_enabled" defaultChecked={Boolean((shiftSettings as { auto_shift_enabled?: boolean } | null)?.auto_shift_enabled)} />
                    自動生成を有効化
                  </label>
                </div>
                <div>
                  <Button type="submit" className="inline-flex h-9 w-auto items-center px-4">店舗設定を保存</Button>
                </div>
              </form>

              <section className="mb-6 rounded border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-200">プロ向けシフト最適化</h3>
                <form action="/api/staff-shifts/settings/optimization" method="post" className="space-y-3">
                  <input type="hidden" name="redirect_to" value="/staffs?tab=shift-settings" />
                  <input type="hidden" name="shift_optimization_enabled" value="false" />
                  <input type="hidden" name="scheduled_auto_run_enabled" value="false" />
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        name="shift_optimization_enabled"
                        value="true"
                        defaultChecked={isShiftOptimizationEnabled}
                        disabled={!isProPlan}
                      />
                      最適化シフト生成を有効化
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        name="scheduled_auto_run_enabled"
                        value="true"
                        defaultChecked={isScheduledAutoRunEnabled}
                        disabled={!isProPlan}
                      />
                      定期自動運転を有効化
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      公平性重み
                      <Input type="number" name="fairness_weight" min={0} max={1} step="0.01" defaultValue={optimizationWeights.fairness_weight} className="h-10" disabled={!isProPlan} />
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      希望勤務重み
                      <Input type="number" name="preferred_shift_weight" min={0} max={1} step="0.01" defaultValue={optimizationWeights.preferred_shift_weight} className="h-10" disabled={!isProPlan} />
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      予約カバー重み
                      <Input type="number" name="reservation_coverage_weight" min={0} max={1} step="0.01" defaultValue={optimizationWeights.reservation_coverage_weight} className="h-10" disabled={!isProPlan} />
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      負荷健全性重み
                      <Input type="number" name="workload_health_weight" min={0} max={1} step="0.01" defaultValue={optimizationWeights.workload_health_weight} className="h-10" disabled={!isProPlan} />
                    </label>
                  </div>
                  {!isProPlan ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">この設定はプロプランで有効化できます（スタンダードは表示のみ）。</p>
                  ) : null}
                  <Button type="submit" className="inline-flex h-9 w-auto items-center px-4" disabled={!isProPlan}>
                    最適化設定を保存
                  </Button>
                </form>
              </section>

              {isProPlan ? (
                <section className="mb-6 rounded border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-200">定期自動運転ジョブ</h3>
                  <form action="/api/staff-shifts/scheduled-jobs" method="post" className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-6">
                    <input type="hidden" name="redirect_to" value="/staffs?tab=shift-settings" />
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      頻度
                      <select name="frequency" defaultValue="weekly" className="h-10 w-full rounded border px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <option value="daily">毎日</option>
                        <option value="weekly">毎週</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      実行時刻
                      <Input type="time" name="run_at_local_time" defaultValue="09:00" className="h-10" />
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      曜日(weekly)
                      <select name="run_weekday" defaultValue="1" className="h-10 w-full rounded border px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <option value="0">日</option>
                        <option value="1">月</option>
                        <option value="2">火</option>
                        <option value="3">水</option>
                        <option value="4">木</option>
                        <option value="5">金</option>
                        <option value="6">土</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      生成期間(日)
                      <Input type="number" min={1} max={90} name="target_horizon_days" defaultValue={String(safeShiftHorizonDays)} className="h-10" />
                    </label>
                    <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-gray-700 dark:text-slate-300">
                      <input type="checkbox" name="is_active" value="true" defaultChecked />
                      有効
                    </label>
                    <div className="flex items-end">
                      <Button type="submit" className="inline-flex h-10 w-full items-center justify-center">ジョブ追加</Button>
                    </div>
                  </form>
                  {shiftScheduledJobs.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">登録済みジョブはありません。</p>
                  ) : (
                    <div className="space-y-2">
                      {(shiftScheduledJobs as Array<{
                        id: string
                        is_active: boolean
                        frequency: string
                        run_at_local_time: string
                        run_weekday: number | null
                        target_horizon_days: number
                        updated_at: string
                      }>).map((job) => (
                        <div key={job.id} className="rounded border border-gray-200 p-2 dark:border-slate-700">
                          <form action={`/api/staff-shifts/scheduled-jobs/${job.id}`} method="post" className="grid grid-cols-1 gap-2 md:grid-cols-7">
                            <input type="hidden" name="_method" value="patch" />
                            <input type="hidden" name="redirect_to" value="/staffs?tab=shift-settings" />
                            <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                              頻度
                              <select name="frequency" defaultValue={job.frequency} className="h-9 w-full rounded border px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                                <option value="daily">毎日</option>
                                <option value="weekly">毎週</option>
                              </select>
                            </label>
                            <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                              時刻
                              <Input type="time" name="run_at_local_time" defaultValue={job.run_at_local_time.slice(0, 5)} className="h-9" />
                            </label>
                            <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                              曜日
                              <select name="run_weekday" defaultValue={job.run_weekday == null ? '' : String(job.run_weekday)} className="h-9 w-full rounded border px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                                <option value="">未指定</option>
                                <option value="0">日</option>
                                <option value="1">月</option>
                                <option value="2">火</option>
                                <option value="3">水</option>
                                <option value="4">木</option>
                                <option value="5">金</option>
                                <option value="6">土</option>
                              </select>
                            </label>
                            <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                              生成期間(日)
                              <Input type="number" min={1} max={90} name="target_horizon_days" defaultValue={String(job.target_horizon_days)} className="h-9" />
                            </label>
                            <label className="inline-flex items-center gap-2 self-end pb-1 text-sm text-gray-700 dark:text-slate-300">
                              <input type="checkbox" name="is_active" value="true" defaultChecked={job.is_active} />
                              有効
                            </label>
                            <div className="flex items-end">
                              <Button type="submit" className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap border border-blue-700 bg-blue-600 text-white hover:bg-blue-700">
                                更新
                              </Button>
                            </div>
                            <div className="flex items-end">
                              <button
                                type="submit"
                                name="_method"
                                value="delete"
                                className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                              >
                                削除
                              </button>
                            </div>
                          </form>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                            {formatScheduleFrequencyLabel(job.frequency)} / 最終更新 {formatIsoDateTime(job.updated_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">スタッフ勤務条件</h3>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {staffs.map((staff) => {
                  const rule = workRuleByStaffId.get(staff.id)
                  return (
                    <form key={staff.id} action={`/api/staff-shifts/settings/staff-rules/${staff.id}`} method="post" className="grid grid-cols-1 gap-3 rounded border border-gray-200 p-3 xl:grid-cols-2">
                      <input type="hidden" name="redirect_to" value="/staffs?tab=shift-settings" />
                      <div className="flex items-center justify-between gap-2 xl:col-span-2">
                        <p className="text-sm font-semibold text-gray-900">{staff.full_name}</p>
                        <Button type="submit" className="inline-flex h-9 w-auto items-center px-4">保存</Button>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-sm text-gray-700">区分</span>
                          <select name="employment_type" defaultValue={rule?.employment_type ?? 'full_time'} className="h-10 w-full rounded border px-2 text-sm">
                            <option value="full_time">正社員</option>
                            <option value="part_time">パート</option>
                            <option value="arubaito">アルバイト</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-sm text-gray-700">週上限（分）</span>
                          <Input type="number" min={0} name="weekly_max_minutes" defaultValue={String(rule?.weekly_max_minutes ?? '')} className="h-10" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-sm text-gray-700">連勤上限（日）</span>
                          <Input type="number" min={0} name="max_consecutive_days" defaultValue={String(rule?.max_consecutive_days ?? '')} className="h-10" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-sm text-gray-700">希望勤務（分）</span>
                          <Input type="number" min={0} name="preferred_shift_minutes" defaultValue={String(rule?.preferred_shift_minutes ?? '')} className="h-10" />
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" name="can_be_nominated" defaultChecked={rule?.can_be_nominated ?? true} />
                          指名対応可
                        </label>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <label className="block min-w-0 space-y-1 text-sm text-gray-700">
                          勤務可能枠（`曜日:開始-終了` 改行区切り）
                          <textarea
                            name="available_slots_text"
                            defaultValue={rule ? slotTextByRuleId.get(rule.id) ?? '' : ''}
                            rows={7}
                            className="box-border w-full max-w-full rounded border px-2 py-1 text-sm"
                            placeholder={'1:09:00-18:00\n2:10:00-19:00'}
                          />
                        </label>
                        <label className="block min-w-0 space-y-1 text-sm text-gray-700">
                          希望休（日付指定, YYYY-MM-DD 改行区切り）
                          <textarea
                            name="day_off_dates_text"
                            defaultValue={dayOffTextByStaffId.get(staff.id) ?? ''}
                            className="box-border min-h-20 w-full max-w-full rounded border px-2 py-1 text-sm"
                            placeholder={'2026-05-03\n2026-05-10'}
                          />
                        </label>
                      </div>
                    </form>
                  )
                })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">シフト設定は owner/admin のみ編集できます。</p>
          )}
        </Card>
      ) : null}

      {activeTab === 'shift-history' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">シフト変更履歴</h2>
            <form action="/staffs" method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="shift-history" />
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                期間開始
                <Input type="date" name="history_from" defaultValue={historyFrom} className="h-9" />
              </label>
              <label className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                期間終了
                <Input type="date" name="history_to" defaultValue={historyTo} className="h-9" />
              </label>
              <Button type="submit" className="inline-flex h-9 items-center justify-center whitespace-nowrap">
                表示更新
              </Button>
            </form>
          </div>

          {shiftHistoryError ? (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              履歴データの取得でエラーが発生しました: {shiftHistoryError}
            </div>
          ) : null}

          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">自動生成実行履歴</h3>
            {shiftHistoryRuns.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">指定期間の実行履歴はありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-left text-sm">
                  <thead className="border-b bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2">実行日時</th>
                      <th className="px-2 py-2">実行者</th>
                      <th className="px-2 py-2">期間</th>
                      <th className="px-2 py-2">モード</th>
                      <th className="px-2 py-2">戦略</th>
                      <th className="px-2 py-2">総合スコア</th>
                      <th className="px-2 py-2">件数サマリ</th>
                      <th className="px-2 py-2">実行ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {shiftHistoryRuns.map((run) => (
                      <tr key={run.id}>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatIsoDateTime(run.created_at)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          {run.requested_by_user_id
                            ? staffNameByUserId.get(run.requested_by_user_id) ?? run.requested_by_user_id
                            : '不明'}
                        </td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{run.from_date} - {run.to_date}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{run.mode === 'apply_draft' ? '反映' : 'プレビュー'}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          {formatShiftStrategyLabel((run.summary?.strategy as string | undefined) ?? null)}
                        </td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          {typeof run.summary?.total_score === 'number'
                            ? String(run.summary.total_score)
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          {`作成 ${Number((run.summary?.created as number | undefined) ?? 0)} / 更新 ${Number((run.summary?.updated as number | undefined) ?? 0)} / 削除 ${Number((run.summary?.deleted as number | undefined) ?? 0)}`}
                        </td>
                        <td className="truncate px-2 py-2 text-xs text-gray-500 dark:text-slate-400">{run.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">変更明細</h3>
            {shiftHistoryItems.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">指定期間の変更明細はありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-left text-sm">
                  <thead className="border-b bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2">日時</th>
                      <th className="px-2 py-2">日付</th>
                      <th className="px-2 py-2">スタッフ</th>
                      <th className="px-2 py-2">種別</th>
                      <th className="px-2 py-2">内容</th>
                      <th className="px-2 py-2">実行ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {shiftHistoryItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatIsoDateTime(item.created_at)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{item.shift_date}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          {item.staff_id ? staffNameById.get(item.staff_id) ?? item.staff_id : '未指定'}
                        </td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatShiftHistoryAction(item.action_type)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{item.message ?? '-'}</td>
                        <td className="truncate px-2 py-2 text-xs text-gray-500 dark:text-slate-400">{item.run_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Card>
      ) : null}

      {activeTab === 'attendance-punch' || activeTab === 'attendance-records' ? (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {attendanceView === 'punch' ? '勤務打刻' : '勤怠管理'}
            </h2>
          </div>

          {attendanceView === 'punch' ? (
            <>
              {canManageShifts ? (
                <form action="/staffs" method="get" className="mb-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="tab" value="attendance-punch" />
                  <input type="hidden" name="attendance_from" value={attendanceFrom} />
                  <input type="hidden" name="attendance_to" value={attendanceTo} />
                  <label className="text-sm text-gray-700 dark:text-slate-300">勤務打刻対象スタッフ</label>
                  <select
                    name="attendance_staff_id"
                    defaultValue={attendanceStaffId}
                    className="h-10 min-w-48 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900"
                  >
                    {attendanceTargetStaffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id} className="bg-white text-gray-900">
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" className="border border-blue-700 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400">
                    対象を反映
                  </Button>
                </form>
              ) : null}

              {!canPunchAttendance ? (
                <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  打刻対象スタッフが未設定です。スタッフ紐付け（`staffs.user_id`）を確認してください。
                </p>
              ) : null}

              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {(['clock_in', 'clock_out', 'break_start', 'break_end'] as const).map((eventType) => (
                  <form key={eventType} action="/api/attendance/events" method="post">
                    <input type="hidden" name="event_type" value={eventType} />
                    <input type="hidden" name="staff_id" value={attendanceStaffId} />
                    <input
                      type="hidden"
                      name="redirect_to"
                      value={`/staffs?tab=attendance-punch&attendance_from=${attendanceFrom}&attendance_to=${attendanceTo}&attendance_staff_id=${attendanceStaffId}`}
                    />
                    <Button type="submit" disabled={!canPunchAttendance} className="w-full border border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-indigo-500 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                      {eventType === 'clock_in'
                        ? '出勤打刻'
                        : eventType === 'clock_out'
                          ? '退勤打刻'
                          : eventType === 'break_start'
                            ? '休憩開始'
                            : '休憩終了'}
                    </Button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <>
              <form action="/staffs" method="get" className="mb-4 flex max-w-full flex-wrap items-center gap-2 md:flex-nowrap">
                <input type="hidden" name="tab" value="attendance-records" />
                {canManageShifts ? (
                  <select
                    name="attendance_staff_id"
                    defaultValue={attendanceStaffId}
                    className="h-10 w-44 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900"
                  >
                    {attendanceTargetStaffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id} className="bg-white text-gray-900">
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="hidden" name="attendance_staff_id" value={attendanceStaffId} />
                )}
                <Link
                  href={`/staffs?tab=attendance-records&attendance_month=${attendancePrevMonth}&attendance_staff_id=${attendanceStaffId}`}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded border border-slate-400 bg-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  前月
                </Link>
                <Input
                  type="month"
                  name="attendance_month"
                  defaultValue={attendanceMonth}
                  className="h-10 !w-40 min-w-[10rem] max-w-[10rem]"
                />
                <Link
                  href={`/staffs?tab=attendance-records&attendance_month=${attendanceNextMonth}&attendance_staff_id=${attendanceStaffId}`}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded border border-slate-400 bg-slate-200 px-3 text-sm font-medium text-slate-900 hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  次月
                </Link>
                <Button type="submit" className="h-10 whitespace-nowrap border border-blue-700 bg-blue-600 px-3 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400">
                  表示更新
                </Button>
              </form>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/api/attendance/export.csv?month=${attendanceMonth}&staff_id=${attendanceStaffId}`}
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded border border-emerald-700 bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  CSV出力
                </Link>
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  月次状態: {monthlyClosing?.status === 'closed' ? '確定済み' : '未確定'}
                </span>
                {attendanceMonthClosed ? (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">確定済みのため、この月は閲覧のみ</span>
                ) : null}
                {canManageShifts ? (
                  <form action="/api/attendance/monthly-closing" method="post" className="inline-flex">
                    <input type="hidden" name="target_month" value={attendanceMonth} />
                    <Button type="submit" disabled={attendanceMonthClosed} className="h-9 border border-indigo-700 bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                      月次確定
                    </Button>
                  </form>
                ) : null}
                {currentMembership?.role === 'owner' && monthlyClosing?.status === 'closed' ? (
                  <form action="/api/attendance/monthly-closing/reopen" method="post" className="inline-flex">
                    <input type="hidden" name="target_month" value={attendanceMonth} />
                    <Button type="submit" className="h-9 border border-amber-700 bg-amber-600 px-3 text-white hover:bg-amber-700 dark:border-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400">
                      確定解除
                    </Button>
                  </form>
                ) : null}
              </div>
              {attendanceMonthClosed ? (
                <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="font-medium">この月は勤怠確定済みです。</p>
                  <p>打刻、休暇申請、修正申請、承認/却下/差戻しは無効です。owner が「確定解除」すると再編集できます。</p>
                </div>
              ) : null}

              <form action="/api/attendance/leave-requests" method="post" className="mb-6 grid grid-cols-1 gap-2 rounded border border-gray-200 p-3 md:grid-cols-5 dark:border-slate-700">
                <input
                  type="hidden"
                  name="redirect_to"
                  value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`}
                />
                <Input type="date" name="target_date" defaultValue={todayJst} required />
                <select name="request_type" className="h-10 rounded border px-2 text-sm">
                  <option value="paid_leave">有休</option>
                  <option value="half_leave_am">半休(午前)</option>
                  <option value="half_leave_pm">半休(午後)</option>
                  <option value="special_leave">特休</option>
                  <option value="absence">欠勤</option>
                </select>
                <Input name="reason" required placeholder="休暇理由（必須）" />
                {canManageShifts ? (
                  <select name="staff_id" className="h-10 rounded border px-2 text-sm" disabled={attendanceMonthClosed}>
                    <option value="">スタッフ（自分）</option>
                    {staffs.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="hidden" name="staff_id" value={ownStaffId ?? ''} />
                )}
                <Button type="submit" disabled={attendanceMonthClosed} className="border border-blue-700 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                  休暇申請
                </Button>
              </form>

              {leaveBalances.length > 0 ? (
                <div className="mb-6 rounded border border-gray-200 p-3 text-sm dark:border-slate-700">
                  <h3 className="mb-2 font-semibold text-gray-800 dark:text-slate-100">有休残数</h3>
                  <div className="space-y-1">
                    {(leaveBalances as Array<{
                      id: string
                      granted_days: number
                      used_days: number
                      remaining_days: number
                      effective_from: string
                      effective_to: string
                    }>).slice(0, 2).map((balance) => (
                      <p key={balance.id} className="text-gray-700 dark:text-slate-300">
                        {balance.effective_from}〜{balance.effective_to}: 付与 {balance.granted_days} / 使用 {balance.used_days} / 残 {balance.remaining_days}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {attendanceAlerts.length > 0 ? (
                <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <h3 className="mb-2 font-semibold">勤務アラート</h3>
                  <ul className="space-y-1">
                    {(attendanceAlerts as Array<{
                      id: string
                      business_date: string | null
                      severity: string
                      message: string
                    }>).slice(0, 6).map((alert) => (
                      <li key={alert.id}>
                        {(alert.business_date ?? '-')}: [{alert.severity}] {alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">休暇申請</h3>
                {attendanceLeaveRequests.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">休暇申請はありません。</p>
                ) : (
                  <div className="space-y-2">
                    {(attendanceLeaveRequests as Array<{
                      id: string
                      staff_id: string
                      target_date: string
                      request_type: string
                      reason: string
                      status: 'pending' | 'approved' | 'rejected' | 'returned'
                    }>).slice(0, 12).map((request) => (
                      <div key={request.id} className="rounded border border-gray-200 p-2 text-sm dark:border-slate-700">
                        <p className="font-medium text-gray-900 dark:text-slate-100">
                          {request.target_date} / {staffNameById.get(request.staff_id) ?? request.staff_id} / {formatLeaveRequestType(request.request_type)} / {request.status}
                        </p>
                        <p className="text-gray-600 dark:text-slate-300">{request.reason}</p>
                        {canManageShifts && request.status === 'pending' ? (
                          <div className="mt-2 flex items-center gap-2">
                            <form action={`/api/attendance/leave-requests/${request.id}/review`} method="post">
                              <input type="hidden" name="decision" value="approve" />
                              <input type="hidden" name="redirect_to" value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`} />
                              <Button type="submit" disabled={attendanceMonthClosed} className="h-7 border border-emerald-700 bg-emerald-600 px-2 py-0 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                                承認
                              </Button>
                            </form>
                            <form action={`/api/attendance/leave-requests/${request.id}/review`} method="post">
                              <input type="hidden" name="decision" value="reject" />
                              <input type="hidden" name="redirect_to" value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`} />
                              <Button type="submit" disabled={attendanceMonthClosed} className="h-7 border border-red-700 bg-red-600 px-2 py-0 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                                却下
                              </Button>
                            </form>
                            <form action={`/api/attendance/leave-requests/${request.id}/review`} method="post">
                              <input type="hidden" name="decision" value="return" />
                              <input type="hidden" name="redirect_to" value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`} />
                              <Button type="submit" disabled={attendanceMonthClosed} className="h-7 border border-amber-700 bg-amber-600 px-2 py-0 text-xs text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                                差戻し
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form action="/api/attendance/adjustment-requests" method="post" className="mb-6 grid grid-cols-1 gap-2 rounded border border-gray-200 p-3 md:grid-cols-6 dark:border-slate-700">
                <input
                  type="hidden"
                  name="redirect_to"
                  value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`}
                />
                <Input type="date" name="business_date" defaultValue={todayJst} required />
                <select name="requested_event_type" className="h-10 rounded border px-2 text-sm">
                  <option value="clock_in">出勤</option>
                  <option value="clock_out">退勤</option>
                  <option value="break_start">休憩開始</option>
                  <option value="break_end">休憩終了</option>
                </select>
                <Input type="datetime-local" name="requested_occurred_at" required />
                <Input name="reason" required placeholder="修正理由（必須）" />
                {canManageShifts ? (
                  <select name="staff_id" className="h-10 rounded border px-2 text-sm" disabled={attendanceMonthClosed}>
                    <option value="">スタッフ（自分）</option>
                    {staffs.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="hidden" name="staff_id" value={ownStaffId ?? ''} />
                )}
                <Button type="submit" disabled={attendanceMonthClosed} className="border border-blue-700 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">勤務修正を申請</Button>
              </form>

              {canManageShifts ? (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">修正申請（承認待ち優先）</h3>
                  {attendanceRequests.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">修正申請はありません。</p>
                  ) : (
                    <div className="space-y-2">
                      {(attendanceRequests as Array<{
                        id: string
                        staff_id: string
                        business_date: string
                        reason: string
                        status: 'pending' | 'approved' | 'rejected'
                      }>).slice(0, 12).map((request) => (
                        <div key={request.id} className="rounded border border-gray-200 p-2 text-sm dark:border-slate-700">
                          <p className="font-medium text-gray-900 dark:text-slate-100">
                            {request.business_date} / {staffNameById.get(request.staff_id) ?? request.staff_id} / {request.status}
                          </p>
                          <p className="text-gray-600 dark:text-slate-300">{request.reason}</p>
                          {request.status === 'pending' ? (
                            <div className="mt-2 flex items-center gap-2">
                              <form action={`/api/attendance/adjustment-requests/${request.id}/review`} method="post">
                                <input type="hidden" name="decision" value="approve" />
                                <input
                                  type="hidden"
                                  name="redirect_to"
                                  value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`}
                                />
                                <Button type="submit" disabled={attendanceMonthClosed} className="h-7 border border-emerald-700 bg-emerald-600 px-2 py-0 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-emerald-500 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                                  承認
                                </Button>
                              </form>
                              <form action={`/api/attendance/adjustment-requests/${request.id}/review`} method="post">
                                <input type="hidden" name="decision" value="reject" />
                                <input
                                  type="hidden"
                                  name="redirect_to"
                                  value={`/staffs?tab=attendance-records&attendance_month=${attendanceMonth}&attendance_staff_id=${attendanceStaffId}`}
                                />
                                <Button type="submit" disabled={attendanceMonthClosed} className="h-7 border border-red-700 bg-red-600 px-2 py-0 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 dark:border-red-500 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
                                  却下
                                </Button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-sm text-left">
                  <thead className="border-b bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2">日付</th>
                      <th className="px-2 py-2">曜日</th>
                      <th className="px-2 py-2">出勤</th>
                      <th className="px-2 py-2">退勤</th>
                      <th className="px-2 py-2">休憩開始</th>
                      <th className="px-2 py-2">休憩終了</th>
                      <th className="px-2 py-2">休憩(分)</th>
                      <th className="px-2 py-2">勤務(分)</th>
                      <th className="px-2 py-2">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {attendanceRecordRows.map((row) => (
                      <tr key={row.date}>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{row.date}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{row.weekday}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatTimeJst(row.clockInAt)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatTimeJst(row.clockOutAt)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatTimeJst(row.breakStartAt)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{formatTimeJst(row.breakEndAt)}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{row.breakMinutes}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">{row.workedMinutes}</td>
                        <td className="px-2 py-2 text-gray-700 dark:text-slate-300">
                          <p>{row.status}</p>
                          {canManageShifts && row.locationDetail ? (
                            <details className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                              <summary className="cursor-pointer">位置情報</summary>
                              <p className="mt-1">{row.locationDetail}</p>
                            </details>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {isCreateModalOpen || editStaff ? (
        <FormModal
          title={editStaff ? 'スタッフ情報の更新' : '新規スタッフ登録'}
          closeRedirectTo={modalCloseRedirect}
          description="スタッフ情報はモーダルで入力します。"
          reopenLabel="スタッフモーダルを開く"
        >
          <form
            action={editStaff ? `/api/staffs/${editStaff.id}` : '/api/staffs'}
            method="post"
            className="space-y-4"
          >
            {editStaff && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-gray-700">
                氏名
                <Input
                  name="full_name"
                  required
                  defaultValue={editStaff?.full_name ?? ''}
                  placeholder="山田 太郎"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                メールアドレス
                <Input
                  type="email"
                  name="email"
                  defaultValue={editStaff?.email ?? ''}
                  placeholder="taro@example.com"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                Supabase Auth User ID
                <Input
                  name="user_id"
                  defaultValue={editStaff?.user_id ?? ''}
                  placeholder="auth.users のUUID"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{editStaff ? '更新する' : '登録する'}</Button>
              {editStaff && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </FormModal>
      ) : null}
    </section>
  )
}
