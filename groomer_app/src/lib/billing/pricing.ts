import { canPurchaseOptionsByPlan, normalizePlanCode, type AppPlan } from '@/lib/subscription-plan'

export type BillingCycle = 'monthly' | 'yearly'
export type AiPlanCode = 'none' | 'assist' | 'pro' | 'pro_plus'
export type SubscriptionOptionPricingInput = {
  hotelOptionEnabled?: boolean
  notificationOptionEnabled?: boolean
  aiPlanCode?: AiPlanCode
}

export const ADDITIONAL_STORE_RATE = 0.8
export const SETUP_ASSISTANCE_FEE_JPY = 19800
export const STORAGE_ADDON_UNIT_GB = 10
export const STORAGE_ADDON_UNIT_PRICE_JPY = 300
export const APP_OPTION_PRICING: Record<
  'hotel' | 'notification',
  Record<BillingCycle, number>
> = {
  hotel: {
    monthly: 1500,
    yearly: 18000,
  },
  notification: {
    monthly: 500,
    yearly: 6000,
  },
}

export const APP_PLAN_PRICING: Record<AppPlan, Record<BillingCycle, number>> = {
  light: {
    monthly: 2480,
    yearly: 25296,
  },
  standard: {
    monthly: 3980,
    yearly: 40596,
  },
  pro: {
    monthly: 7980,
    yearly: 81396,
  },
}

export const AI_PLAN_PRICING: Record<Exclude<AiPlanCode, 'none'>, Record<BillingCycle, number>> = {
  assist: {
    monthly: 1280,
    yearly: 15360,
  },
  pro: {
    monthly: 1980,
    yearly: 23760,
  },
  pro_plus: {
    monthly: 2480,
    yearly: 29760,
  },
}

export function parseAiPlanCode(value: unknown): AiPlanCode {
  if (value === 'assist') return 'assist'
  if (value === 'pro') return 'pro'
  if (value === 'pro_plus') return 'pro_plus'
  return 'none'
}

export function parsePlanCode(value: unknown): AppPlan {
  if (typeof value !== 'string') return 'light'
  return normalizePlanCode(value)
}

export function parseBillingCycle(value: unknown): BillingCycle {
  if (value === 'yearly') return 'yearly'
  return 'monthly'
}

export function amountForPlan(plan: AppPlan, cycle: BillingCycle): number {
  return APP_PLAN_PRICING[plan][cycle]
}

export function amountForOptions(
  plan: AppPlan,
  cycle: BillingCycle,
  options: SubscriptionOptionPricingInput
): number {
  if (!canPurchaseOptionsByPlan(plan)) {
    return 0
  }

  let total = 0
  if (options.hotelOptionEnabled) {
    total += APP_OPTION_PRICING.hotel[cycle]
  }
  if (options.notificationOptionEnabled) {
    total += APP_OPTION_PRICING.notification[cycle]
  }
  const aiPlanCode = parseAiPlanCode(options.aiPlanCode)
  if (aiPlanCode !== 'none') {
    total += AI_PLAN_PRICING[aiPlanCode][cycle]
  }
  return total
}

export function amountForSubscription(
  plan: AppPlan,
  cycle: BillingCycle,
  options: SubscriptionOptionPricingInput
): number {
  return amountForPlan(plan, cycle) + amountForOptions(plan, cycle, options)
}

export function applyAdditionalStoreDiscount(baseAmountJpy: number, ownerActiveStoreCount: number): number {
  const normalizedAmount = Number.isFinite(baseAmountJpy) ? Math.max(0, Math.round(baseAmountJpy)) : 0
  const normalizedStoreCount = Number.isFinite(ownerActiveStoreCount)
    ? Math.max(0, Math.floor(ownerActiveStoreCount))
    : 0
  if (normalizedStoreCount <= 1) return normalizedAmount
  return Math.max(0, Math.round(normalizedAmount * ADDITIONAL_STORE_RATE))
}

export function amountForPlanWithStoreCount(
  plan: AppPlan,
  cycle: BillingCycle,
  ownerActiveStoreCount: number
): number {
  return applyAdditionalStoreDiscount(amountForPlan(plan, cycle), ownerActiveStoreCount)
}

export function amountForPlanWithStoreCountAndOptions(
  plan: AppPlan,
  cycle: BillingCycle,
  ownerActiveStoreCount: number,
  options: SubscriptionOptionPricingInput
): number {
  return amountForPlanWithStoreCount(plan, cycle, ownerActiveStoreCount) + amountForOptions(plan, cycle, options)
}

export function amountForStorageAddonUnits(units: number): number {
  const normalizedUnits = Number.isFinite(units) ? Math.max(0, Math.floor(units)) : 0
  return normalizedUnits * STORAGE_ADDON_UNIT_PRICE_JPY
}

function optionEnvSuffix(options: SubscriptionOptionPricingInput): string {
  const suffixes: string[] = []
  if (options.hotelOptionEnabled) {
    suffixes.push('HOTEL')
  }
  if (options.notificationOptionEnabled) {
    suffixes.push('NOTIFICATION')
  }
  const aiPlanCode = parseAiPlanCode(options.aiPlanCode)
  if (aiPlanCode !== 'none') {
    suffixes.push(`AI_${aiPlanCode.toUpperCase()}`)
  }
  return suffixes.length > 0 ? `_${suffixes.join('_')}` : ''
}

export function stripeSubscriptionPriceEnvKey(
  plan: AppPlan,
  cycle: BillingCycle,
  options: SubscriptionOptionPricingInput,
  useAdditionalStorePricing = false
): string {
  return `STRIPE_PRICE_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}${optionEnvSuffix(options)}${
    useAdditionalStorePricing ? '_ADDITIONAL' : ''
  }`
}

export function komojuSubscriptionProductEnvKey(
  plan: AppPlan,
  cycle: BillingCycle,
  options: SubscriptionOptionPricingInput,
  useAdditionalStorePricing = false
): string {
  return `KOMOJU_PRODUCT_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}${optionEnvSuffix(options)}${
    useAdditionalStorePricing ? '_ADDITIONAL' : ''
  }`
}

export function stripeStorageAddonPriceEnvKey(extraCapacityGb: number): string {
  return `STRIPE_PRICE_ID_STORAGE_ADDON_${Math.max(0, Math.floor(extraCapacityGb))}GB_MONTHLY`
}

export function komojuStorageAddonProductEnvKey(extraCapacityGb: number): string {
  return `KOMOJU_PRODUCT_ID_STORAGE_ADDON_${Math.max(0, Math.floor(extraCapacityGb))}GB_MONTHLY`
}

export function stripePriceEnvKey(plan: AppPlan, cycle: BillingCycle): string {
  return `STRIPE_PRICE_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}`
}

export function komojuProductEnvKey(plan: AppPlan, cycle: BillingCycle): string {
  return `KOMOJU_PRODUCT_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}`
}

export function stripeAdditionalPriceEnvKey(plan: AppPlan, cycle: BillingCycle): string {
  return `STRIPE_PRICE_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}_ADDITIONAL`
}

export function komojuAdditionalProductEnvKey(plan: AppPlan, cycle: BillingCycle): string {
  return `KOMOJU_PRODUCT_ID_${plan.toUpperCase()}_${cycle.toUpperCase()}_ADDITIONAL`
}
