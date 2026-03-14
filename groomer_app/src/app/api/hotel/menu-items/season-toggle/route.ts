import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { asObjectOrNull } from '@/lib/object-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireStoreContext() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return { ok: false as const, status: 403, message: membershipError?.message ?? 'Forbidden' }
  }

  const access = await requireStoreFeatureAccess({
    supabase,
    storeId,
    minimumPlan: 'standard',
    requiredOption: 'hotel',
  })

  if (!access.ok) {
    return { ok: false as const, status: 403, message: access.message }
  }

  if (!isHotelFeatureEnabledForStore(storeId)) {
    return { ok: false as const, status: 403, message: 'Hotel feature is not enabled for this store.' }
  }

  return { ok: true as const, supabase, storeId, user, role: membership.role as string }
}

export async function POST(request: Request) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const seasonMode = body.season_mode
  if (seasonMode !== 'normal' && seasonMode !== 'high_season') {
    return NextResponse.json({ message: 'season_mode must be normal or high_season.' }, { status: 400 })
  }

  const timestamp = new Date().toISOString()
  const enableHighSeason = seasonMode === 'high_season'

  const [{ error: normalError }, { error: highSeasonError }] = await Promise.all([
    guard.supabase
      .from('hotel_menu_items')
      .update({ is_active: !enableHighSeason, updated_at: timestamp })
      .eq('store_id', guard.storeId)
      .gte('display_order', 10)
      .lte('display_order', 199),
    guard.supabase
      .from('hotel_menu_items')
      .update({ is_active: enableHighSeason, updated_at: timestamp })
      .eq('store_id', guard.storeId)
      .gte('display_order', 300)
      .lte('display_order', 499),
  ])

  if (normalError || highSeasonError) {
    return NextResponse.json(
      { message: normalError?.message ?? highSeasonError?.message ?? 'Season toggle failed.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    season_mode: seasonMode,
    message:
      seasonMode === 'high_season'
        ? 'ハイシーズンメニューを有効化し、通常メニューを無効化しました。'
        : '通常メニューを有効化し、ハイシーズンメニューを無効化しました。',
  })
}
