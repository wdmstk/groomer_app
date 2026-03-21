import {
  canPurchaseOptionsByPlan,
  isPlanAtLeast,
  normalizePlanCode,
  type AppPlan,
} from '@/lib/subscription-plan'
import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type StorePlanSupabase = Pick<SupabaseClient<Database>, 'from'>
export type SupabaseLike = StorePlanSupabase

export function asStorePlanOptionsClient(value: unknown): SupabaseLike {
  return value as StorePlanSupabase
}

type StoreSubscriptionRow = Database['public']['Tables']['store_subscriptions']['Row']

type StoreNotificationSettingsRow =
  Database['public']['Tables']['store_notification_settings']['Row']

export type StorePlanOptionState = {
  planCode: AppPlan
  hotelOptionEnabled: boolean
  notificationOptionEnabled: boolean
  aiPlanCode: AiPlanCode
}

async function fetchSubscriptionRow(supabase: SupabaseLike, storeId: string) {
  const withOption = await supabase
    .from('store_subscriptions')
    .select(
      'plan_code, hotel_option_enabled, notification_option_enabled, ai_plan_code, hotel_option_effective, notification_option_effective, ai_plan_code_effective'
    )
    .eq('store_id', storeId)
    .maybeSingle()

  if (!withOption.error) {
    return (withOption.data ?? null) as StoreSubscriptionRow | null
  }

  // Compatibility fallback before hotel option column migration is applied.
  const fallback = await supabase
    .from('store_subscriptions')
    .select('plan_code, hotel_option_enabled')
    .eq('store_id', storeId)
    .maybeSingle()
  return (fallback.data ?? null) as StoreSubscriptionRow | null
}

async function fetchNotificationOptionRow(supabase: SupabaseLike, storeId: string) {
  const result = await supabase
    .from('store_notification_settings')
    .select('notification_option_enabled')
    .eq('store_id', storeId)
    .maybeSingle()

  if (result.error) {
    // If settings row/table is absent, treat as option off.
    return null
  }
  return (result.data ?? null) as StoreNotificationSettingsRow | null
}

export async function fetchStorePlanOptionState(params: {
  supabase: SupabaseLike
  storeId: string
}): Promise<StorePlanOptionState> {
  const [subscriptionRow, notificationRow] = await Promise.all([
    fetchSubscriptionRow(params.supabase, params.storeId),
    fetchNotificationOptionRow(params.supabase, params.storeId),
  ])

  const planCode = normalizePlanCode(subscriptionRow?.plan_code)
  const optionContractAllowed = canPurchaseOptionsByPlan(planCode)

  return {
    planCode,
    hotelOptionEnabled:
      optionContractAllowed &&
      (
        (subscriptionRow as (StoreSubscriptionRow & { hotel_option_effective?: boolean | null }) | null)
          ?.hotel_option_effective ??
          subscriptionRow?.hotel_option_enabled ??
          false
      ) === true,
    notificationOptionEnabled: optionContractAllowed
      ? // Prefer subscription contract state and keep settings row as backward-compat fallback.
        (
          (subscriptionRow as (StoreSubscriptionRow & { notification_option_effective?: boolean | null }) | null)
            ?.notification_option_effective ??
            subscriptionRow?.notification_option_enabled ??
            notificationRow?.notification_option_enabled ??
            false
        ) === true
      : false,
    aiPlanCode: optionContractAllowed
      ? parseAiPlanCode(
          (
            subscriptionRow as
              | (StoreSubscriptionRow & {
                  ai_plan_code?: string | null
                  ai_plan_code_effective?: string | null
                })
              | null
          )?.ai_plan_code_effective ??
            (subscriptionRow as StoreSubscriptionRow & { ai_plan_code?: string | null } | null)?.ai_plan_code ??
            'none'
        )
      : 'none',
  }
}

export function canAccessByMinimumPlan(state: StorePlanOptionState, minimumPlan: AppPlan) {
  return isPlanAtLeast(state.planCode, minimumPlan)
}
