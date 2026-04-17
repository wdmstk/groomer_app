import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import {
  parseBoolean,
  parseDateKeyList,
  parseInteger,
  parseWorkRuleSlots,
  resolveSafeRedirectTo,
} from '@/lib/staff-shifts/shared'

type RouteContext = {
  params: Promise<{
    staff_id: string
  }>
}

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function normalizeEmploymentType(value: string | null | undefined) {
  if (value === 'part_time' || value === 'arubaito') return value
  return 'full_time'
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const { staff_id: staffId } = await context.params
  const formData = await request.formData()
  const db = toAnyClient(auth.supabase)

  const employmentType = normalizeEmploymentType(formData.get('employment_type')?.toString() ?? null)
  const weeklyMaxMinutes = parseInteger(formData.get('weekly_max_minutes')?.toString() ?? '', 0)
  const maxConsecutiveDays = parseInteger(formData.get('max_consecutive_days')?.toString() ?? '', 0)
  const canBeNominated = parseBoolean(formData.get('can_be_nominated'))
  const preferredShiftMinutes = parseInteger(formData.get('preferred_shift_minutes')?.toString() ?? '', 0)
  const slotsText = formData.get('available_slots_text')?.toString() ?? ''
  const dayOffDatesText = formData.get('day_off_dates_text')?.toString() ?? ''
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)

  const { data: staff, error: staffError } = await db
    .from('staffs')
    .select('id')
    .eq('id', staffId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (staffError) return NextResponse.json({ message: staffError.message }, { status: 500 })
  if (!staff) return NextResponse.json({ message: 'スタッフが見つかりません。' }, { status: 404 })

  const { data: upserted, error: upsertError } = await db
    .from('staff_work_rules')
    .upsert(
      {
        store_id: auth.storeId,
        staff_id: staffId,
        employment_type: employmentType,
        weekly_max_minutes: weeklyMaxMinutes > 0 ? weeklyMaxMinutes : null,
        max_consecutive_days: maxConsecutiveDays > 0 ? maxConsecutiveDays : null,
        can_be_nominated: canBeNominated,
        preferred_shift_minutes: preferredShiftMinutes > 0 ? preferredShiftMinutes : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,staff_id' }
    )
    .select('id')
    .single()

  if (upsertError) return NextResponse.json({ message: upsertError.message }, { status: 500 })

  const workRuleId = upserted.id as string
  const { error: deleteSlotsError } = await db
    .from('staff_work_rule_slots')
    .delete()
    .eq('store_id', auth.storeId)
    .eq('staff_work_rule_id', workRuleId)
  if (deleteSlotsError) return NextResponse.json({ message: deleteSlotsError.message }, { status: 500 })

  const slots = parseWorkRuleSlots(slotsText)
  if (slots.length > 0) {
    const { error: insertSlotsError } = await db.from('staff_work_rule_slots').insert(
      slots.map((slot) => ({
        store_id: auth.storeId,
        staff_work_rule_id: workRuleId,
        weekday: slot.weekday,
        start_time: slot.start_time,
        end_time: slot.end_time,
      }))
    )
    if (insertSlotsError) return NextResponse.json({ message: insertSlotsError.message }, { status: 500 })
  }

  const dayOffDates = parseDateKeyList(dayOffDatesText)
  const { error: deleteDayOffError } = await db
    .from('staff_day_off_requests')
    .delete()
    .eq('store_id', auth.storeId)
    .eq('staff_id', staffId)
  if (deleteDayOffError && !`${deleteDayOffError.message}`.includes('staff_day_off_requests')) {
    return NextResponse.json({ message: deleteDayOffError.message }, { status: 500 })
  }

  if (dayOffDates.length > 0) {
    const { error: insertDayOffError } = await db.from('staff_day_off_requests').insert(
      dayOffDates.map((dayOffDate) => ({
        store_id: auth.storeId,
        staff_id: staffId,
        day_off_date: dayOffDate,
        status: 'approved',
        note: 'shift_settings_ui',
      }))
    )
    if (insertDayOffError && !`${insertDayOffError.message}`.includes('staff_day_off_requests')) {
      return NextResponse.json({ message: insertDayOffError.message }, { status: 500 })
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }
  return NextResponse.json({ ok: true })
}
