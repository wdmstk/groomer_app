import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
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

  const slotDays = clampInt(Number(formData.get('public_reserve_slot_days')), 1, 7, 7)
  const slotIntervalMinutes = clampInt(
    Number(formData.get('public_reserve_slot_interval_minutes')),
    30,
    30,
    30
  )
  const slotBufferMinutes = clampInt(
    Number(formData.get('public_reserve_slot_buffer_minutes')),
    0,
    60,
    15
  )
  const businessStartHour = clampInt(
    Number(formData.get('public_reserve_business_start_hour_jst')),
    0,
    23,
    10
  )
  const businessEndHour = clampInt(
    Number(formData.get('public_reserve_business_end_hour_jst')),
    businessStartHour + 1,
    24,
    18
  )
  const minLeadMinutes = clampInt(
    Number(formData.get('public_reserve_min_lead_minutes')),
    60,
    24 * 60,
    60
  )

  const { error: updateError } = await supabase
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

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}

