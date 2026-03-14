import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { normalizePlanCode } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { DEFAULT_UI_THEME, isUiTheme } from '@/lib/ui/themes'

type StoreMembershipRow = {
  store_id: string
  role: 'owner' | 'admin' | 'staff'
  stores?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
}

type StoreSubscriptionRow = {
  store_id: string
  plan_code: string | null
}

type StaffThemeRow = {
  store_id: string
  ui_theme: string | null
}

function pickStoreName(
  relation: StoreMembershipRow['stores']
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation.name ?? null
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const activeStoreId = await resolveCurrentStoreId()

  const { data, error } = await supabase
    .from('store_memberships')
    .select('store_id, role, stores(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const stores = ((data ?? []) as StoreMembershipRow[]).map((row) => ({
    id: row.store_id,
    name: pickStoreName(row.stores) ?? '店舗名未設定',
    role: row.role,
  }))
  const storeIds = stores.map((store) => store.id)

  let planCodeByStoreId = new Map<string, string>()
  let uiThemeByStoreId = new Map<string, string>()
  if (storeIds.length > 0) {
    const { data: subscriptionRows } = await supabase
      .from('store_subscriptions')
      .select('store_id, plan_code')
      .in('store_id', storeIds)

    planCodeByStoreId = new Map(
      ((subscriptionRows ?? []) as StoreSubscriptionRow[]).map((row) => [
        row.store_id,
        normalizePlanCode(row.plan_code),
      ])
    )

    const { data: staffThemeRows } = await supabase
      .from('staffs')
      .select('store_id, ui_theme')
      .eq('user_id', user.id)
      .in('store_id', storeIds)

    uiThemeByStoreId = new Map(
      ((staffThemeRows ?? []) as StaffThemeRow[]).map((row) => [
        row.store_id,
        isUiTheme(row.ui_theme) ? row.ui_theme : DEFAULT_UI_THEME,
      ])
    )
  }

  const storesWithPlan = await Promise.all(
    stores.map(async (store) => {
      const planCode = planCodeByStoreId.get(store.id) ?? 'light'
      const optionState = await fetchStorePlanOptionState({
        supabase: asStorePlanOptionsClient(supabase),
        storeId: store.id,
      })
      return {
        ...store,
        planCode,
        uiTheme: uiThemeByStoreId.get(store.id) ?? DEFAULT_UI_THEME,
        hotelOptionEnabled: optionState.hotelOptionEnabled,
        notificationOptionEnabled: optionState.notificationOptionEnabled,
      }
    })
  )

  return NextResponse.json({
    activeStoreId,
    stores: storesWithPlan,
    user: {
      email: user.email ?? '',
    },
  })
}
