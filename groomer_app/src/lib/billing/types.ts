export type BillingProvider = 'stripe' | 'komoju'

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'

export type BillingCustomerRow = {
  id: string
  store_id: string
  user_id: string
  provider: BillingProvider
  provider_customer_id: string
  email: string | null
}

export type BillingSubscriptionRow = {
  id: string
  store_id: string
  provider: BillingProvider
  billing_customer_id: string | null
  provider_subscription_id: string | null
  status: BillingStatus
  trial_end: string | null
  current_period_end: string | null
}
