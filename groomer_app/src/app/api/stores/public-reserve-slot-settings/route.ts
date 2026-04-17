import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function parseOptionalInt(formData: FormData, key: string) {
  const raw = formData.get(key)?.toString().trim() ?? ''
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return NextResponse.json({ message: '所属情報の取得に失敗しました。' }, { status: 403 })
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ message: 'この操作は owner/admin のみ実行できます。' }, { status: 403 })
  }

  const admin = (() => {
    try {
      return createAdminSupabaseClient()
    } catch {
      return null
    }
  })()
  const storeWriter = admin ?? supabase

  const { data: currentStoreSettings } = await storeWriter
    .from('stores')
    .select(
      'public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes'
    )
    .eq('id', storeId)
    .maybeSingle()

  const currentSlotDays = Number(currentStoreSettings?.public_reserve_slot_days ?? 7) || 7
  const currentSlotIntervalMinutes =
    Number(currentStoreSettings?.public_reserve_slot_interval_minutes ?? 30) || 30
  const currentSlotBufferMinutes =
    Number(currentStoreSettings?.public_reserve_slot_buffer_minutes ?? 15) || 15
  const currentBusinessStartHour =
    Number(currentStoreSettings?.public_reserve_business_start_hour_jst ?? 9) || 9
  const currentBusinessEndHour =
    Number(currentStoreSettings?.public_reserve_business_end_hour_jst ?? 19) || 19
  const currentMinLeadMinutes =
    Number(currentStoreSettings?.public_reserve_min_lead_minutes ?? 60) || 60

  const rawBusinessStartHour = parseOptionalInt(formData, 'public_reserve_business_start_hour_jst')
  const rawBusinessEndHour = parseOptionalInt(formData, 'public_reserve_business_end_hour_jst')
  if (rawBusinessStartHour === null || rawBusinessEndHour === null) {
    return NextResponse.json(
      { message: '営業時間の保存値が不正です。開始時刻・終了時刻を確認してください。' },
      { status: 400 }
    )
  }

  const slotDays = clampInt(
    parseOptionalInt(formData, 'public_reserve_slot_days') ?? Number.NaN,
    1,
    7,
    currentSlotDays
  )
  const slotIntervalMinutes = clampInt(
    parseOptionalInt(formData, 'public_reserve_slot_interval_minutes') ?? Number.NaN,
    30,
    30,
    currentSlotIntervalMinutes
  )
  const slotBufferMinutes = clampInt(
    parseOptionalInt(formData, 'public_reserve_slot_buffer_minutes') ?? Number.NaN,
    0,
    60,
    currentSlotBufferMinutes
  )
  const businessStartHour = clampInt(rawBusinessStartHour, 0, 23, currentBusinessStartHour)
  const businessEndHour = clampInt(
    rawBusinessEndHour,
    businessStartHour + 1,
    24,
    currentBusinessEndHour
  )
  const minLeadMinutes = clampInt(
    parseOptionalInt(formData, 'public_reserve_min_lead_minutes') ?? Number.NaN,
    60,
    24 * 60,
    currentMinLeadMinutes
  )

  const { error: updateError } = await storeWriter
    .from('stores')
    .update({
      public_reserve_slot_days: slotDays,
      public_reserve_slot_interval_minutes: slotIntervalMinutes,
      public_reserve_slot_buffer_minutes: slotBufferMinutes,
      public_reserve_business_start_hour_jst: businessStartHour,
      public_reserve_business_end_hour_jst: businessEndHour,
      public_reserve_min_lead_minutes: minLeadMinutes,
    })
    .eq('id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  if (formData.has('calendar_expand_out_of_range_appointments')) {
    const calendarExpandOutOfRangeAppointments = formData
      .getAll('calendar_expand_out_of_range_appointments')
      .some((value) => value?.toString() === 'true')
    const { data } = await storeWriter
      .from('store_customer_management_settings' as never)
      .select(
        'medical_record_list_limit, journal_visibility_mode, followup_snoozed_refollow_days, followup_no_need_refollow_days, followup_lost_refollow_days'
      )
      .eq('store_id', storeId)
      .maybeSingle()
    const currentCustomerSettings = data as
      | {
          medical_record_list_limit?: number | null
          journal_visibility_mode?: string | null
          followup_snoozed_refollow_days?: number | null
          followup_no_need_refollow_days?: number | null
          followup_lost_refollow_days?: number | null
        }
      | null
    const { error: customerUpdateError } = await storeWriter
      .from('store_customer_management_settings' as never)
      .upsert(
        {
          store_id: storeId,
          medical_record_list_limit: Number(currentCustomerSettings?.medical_record_list_limit ?? 10),
          journal_visibility_mode:
            currentCustomerSettings?.journal_visibility_mode === 'include_drafts'
              ? 'include_drafts'
              : 'published_only',
          followup_snoozed_refollow_days: Number(currentCustomerSettings?.followup_snoozed_refollow_days ?? 7),
          followup_no_need_refollow_days: Number(currentCustomerSettings?.followup_no_need_refollow_days ?? 60),
          followup_lost_refollow_days: Number(currentCustomerSettings?.followup_lost_refollow_days ?? 90),
          calendar_expand_out_of_range_appointments: calendarExpandOutOfRangeAppointments,
        } as never,
        { onConflict: 'store_id' }
      )
    if (customerUpdateError) {
      return NextResponse.json({ message: customerUpdateError.message }, { status: 500 })
    }
  }

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}

