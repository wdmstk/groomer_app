import { optionLabel, planLabel, type AppOption, type AppPlan } from '@/lib/subscription-plan'
import {
  asStorePlanOptionsClient,
  canAccessByMinimumPlan,
  fetchStorePlanOptionState,
} from '@/lib/store-plan-options'

export type StoreFeatureAccessResult = {
  ok: boolean
  status: number
  message: string
  state: {
    planCode: AppPlan
    hotelOptionEnabled: boolean
    notificationOptionEnabled: boolean
  }
}

export async function requireStoreFeatureAccess(params: {
  supabase: unknown
  storeId: string
  minimumPlan: AppPlan
  requiredOption?: AppOption | null
}): Promise<StoreFeatureAccessResult> {
  const state = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(params.supabase),
    storeId: params.storeId,
  })

  const hasMinimumPlan = canAccessByMinimumPlan(state, params.minimumPlan)
  if (!hasMinimumPlan) {
    return {
      ok: false,
      status: 403,
      message: `${planLabel(params.minimumPlan)}以上のプランで利用できます。`,
      state,
    }
  }

  if (params.requiredOption === 'hotel' && !state.hotelOptionEnabled) {
    return {
      ok: false,
      status: 403,
      message: `${optionLabel('hotel')}の契約が必要です。`,
      state,
    }
  }
  if (params.requiredOption === 'notification' && !state.notificationOptionEnabled) {
    return {
      ok: false,
      status: 403,
      message: `${optionLabel('notification')}の契約が必要です。`,
      state,
    }
  }

  return {
    ok: true,
    status: 200,
    message: 'ok',
    state,
  }
}
