import { parseAiPlanCode, parsePlanCode, type AiPlanCode } from '@/lib/billing/pricing'
import { canPurchaseOptionsByPlan } from '@/lib/subscription-plan'

export type TrialRolloverSubscriptionOptionsSource = {
  plan_code: string | null
  ai_plan_code_requested: string | null
  ai_plan_code_effective: string | null
  ai_plan_code: string | null
  hotel_option_requested: boolean | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
  notification_option_requested: boolean | null
  notification_option_effective: boolean | null
  notification_option_enabled: boolean | null
}

export type TrialRolloverBillingOptions = {
  hotelOptionEnabled: boolean
  notificationOptionEnabled: boolean
  aiPlanCode: AiPlanCode
}

export function resolveTrialRolloverBillingOptions(
  row: TrialRolloverSubscriptionOptionsSource
): TrialRolloverBillingOptions {
  const plan = parsePlanCode(row.plan_code)
  const optionContractAllowed = canPurchaseOptionsByPlan(plan)
  if (!optionContractAllowed) {
    return {
      hotelOptionEnabled: false,
      notificationOptionEnabled: false,
      aiPlanCode: 'none',
    }
  }

  const hotelOptionEnabled =
    (row.hotel_option_effective ?? row.hotel_option_requested ?? row.hotel_option_enabled ?? false) === true
  const notificationOptionEnabled =
    (row.notification_option_effective ??
      row.notification_option_requested ??
      row.notification_option_enabled ??
      false) === true
  const aiPlanCode = parseAiPlanCode(
    row.ai_plan_code_effective ?? row.ai_plan_code_requested ?? row.ai_plan_code ?? 'none'
  )

  return {
    hotelOptionEnabled,
    notificationOptionEnabled,
    aiPlanCode,
  }
}
