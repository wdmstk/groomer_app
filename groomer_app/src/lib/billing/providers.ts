import type { BillingProvider } from './types'
import type { AppPlan } from '@/lib/subscription-plan'
import type { Json } from '@/lib/supabase/database.types'
import {
  komojuStorageAddonProductEnvKey,
  komojuSubscriptionProductEnvKey,
  komojuAdditionalProductEnvKey,
  komojuProductEnvKey,
  stripeStorageAddonPriceEnvKey,
  stripeSubscriptionPriceEnvKey,
  stripeAdditionalPriceEnvKey,
  stripePriceEnvKey,
  type BillingCycle,
  type SubscriptionOptionPricingInput,
} from './pricing'

type StripeCustomer = {
  id: string
}

type StripeCheckoutSession = {
  id: string
  url: string | null
  customer: string | null
  subscription: string | null
}

type StripeSubscription = {
  id: string
  status: string
  current_period_end: number | null
}

type StripeCanceledSubscription = {
  id: string
  status: string
  current_period_end: number | null
}

type KomojuCheckoutSession = {
  id: string
  url: string | null
  customer: string | null
  subscription: string | null
}

type KomojuSubscription = {
  id: string
  status: string
  current_period_end: string | null
}

type StripeOneTimeCheckoutSession = {
  id: string
  url: string | null
  customer: string | null
  payment_intent?: string | null
}

async function getStripe<T>(path: string) {
  const secret = requireEnv('STRIPE_SECRET_KEY')
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.error?.message === 'string' ? json.error.message : 'Stripe API error'
    throw new Error(message)
  }
  return json as T
}

async function deleteStripe<T>(path: string) {
  const secret = requireEnv('STRIPE_SECRET_KEY')
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.error?.message === 'string' ? json.error.message : 'Stripe API error'
    throw new Error(message)
  }
  return json as T
}

async function getKomoju<T>(path: string) {
  const secret = requireEnv('KOMOJU_SECRET_KEY')
  const apiBase = process.env.KOMOJU_API_BASE_URL ?? 'https://api.komoju.com'
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.message === 'string' ? json.message : 'KOMOJU API error'
    throw new Error(message)
  }
  return json as T
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function buildFormEncoded(payload: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    params.set(key, String(value))
  })
  return params
}

async function postStripeForm<T>(path: string, payload: Record<string, string | number | boolean | null | undefined>) {
  const secret = requireEnv('STRIPE_SECRET_KEY')
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildFormEncoded(payload).toString(),
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.error?.message === 'string' ? json.error.message : 'Stripe API error'
    throw new Error(message)
  }
  return json as T
}

async function postKomojuJson<T>(path: string, payload: Json) {
  const secret = requireEnv('KOMOJU_SECRET_KEY')
  const apiBase = process.env.KOMOJU_API_BASE_URL ?? 'https://api.komoju.com'
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.message === 'string' ? json.message : 'KOMOJU API error'
    throw new Error(message)
  }
  return json as T
}

function optionMetadata(options: SubscriptionOptionPricingInput) {
  return {
    hotel_option_enabled: options.hotelOptionEnabled ? 'true' : 'false',
    notification_option_enabled: options.notificationOptionEnabled ? 'true' : 'false',
  }
}

export async function createStripeCustomer({
  email,
  storeId,
  userId,
}: {
  email: string
  storeId: string
  userId: string
}) {
  const customer = await postStripeForm<StripeCustomer>('customers', {
    email,
    'metadata[store_id]': storeId,
    'metadata[user_id]': userId,
  })
  return customer.id
}

export async function createStripeCheckoutSession({
  customerId,
  successUrl,
  cancelUrl,
  plan,
  billingCycle,
  storeId,
  userId,
  amountJpy,
  useAdditionalStorePricing,
  options,
}: {
  customerId: string
  successUrl: string
  cancelUrl: string
  plan: AppPlan
  billingCycle: BillingCycle
  storeId: string
  userId: string
  amountJpy: number
  useAdditionalStorePricing?: boolean
  options: SubscriptionOptionPricingInput
}) {
  const optionAwarePriceKey = stripeSubscriptionPriceEnvKey(
    plan,
    billingCycle,
    options,
    useAdditionalStorePricing
  )
  const fallbackAdditionalPriceId = useAdditionalStorePricing
    ? process.env[stripeAdditionalPriceEnvKey(plan, billingCycle)] ?? ''
    : ''
  const priceId =
    process.env[optionAwarePriceKey] ||
    fallbackAdditionalPriceId ||
    process.env[stripePriceEnvKey(plan, billingCycle)] ||
    process.env.STRIPE_PRICE_ID_MONTHLY_1000 ||
    ''
  if (!priceId) {
    throw new Error(
      `Missing ${optionAwarePriceKey} (or ${stripePriceEnvKey(plan, billingCycle)} / ${stripeAdditionalPriceEnvKey(plan, billingCycle)} / STRIPE_PRICE_ID_MONTHLY_1000).`
    )
  }
  const session = await postStripeForm<StripeCheckoutSession>('checkout/sessions', {
    mode: 'subscription',
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    'metadata[store_id]': storeId,
    'metadata[user_id]': userId,
    'metadata[plan]': plan,
    'metadata[billing_cycle]': billingCycle,
    'metadata[amount_jpy]': Math.max(0, Math.round(amountJpy)),
    'metadata[hotel_option_enabled]': optionMetadata(options).hotel_option_enabled,
    'metadata[notification_option_enabled]': optionMetadata(options).notification_option_enabled,
    'subscription_data[metadata][provider]': 'stripe',
    'subscription_data[metadata][store_id]': storeId,
    'subscription_data[metadata][user_id]': userId,
    'subscription_data[metadata][plan]': plan,
    'subscription_data[metadata][billing_cycle]': billingCycle,
    'subscription_data[metadata][amount_jpy]': Math.max(0, Math.round(amountJpy)),
    'subscription_data[metadata][hotel_option_enabled]': optionMetadata(options).hotel_option_enabled,
    'subscription_data[metadata][notification_option_enabled]':
      optionMetadata(options).notification_option_enabled,
  })
  if (!session.url) {
    throw new Error('Stripe checkout URL is empty.')
  }
  return session
}

export async function createStripeSubscription({
  customerId,
  plan,
  billingCycle,
  useAdditionalStorePricing,
  options,
}: {
  customerId: string
  plan: AppPlan
  billingCycle: BillingCycle
  useAdditionalStorePricing?: boolean
  options: SubscriptionOptionPricingInput
}) {
  const optionAwarePriceKey = stripeSubscriptionPriceEnvKey(
    plan,
    billingCycle,
    options,
    useAdditionalStorePricing
  )
  const fallbackAdditionalPriceId = useAdditionalStorePricing
    ? process.env[stripeAdditionalPriceEnvKey(plan, billingCycle)] ?? ''
    : ''
  const priceId =
    process.env[optionAwarePriceKey] ||
    fallbackAdditionalPriceId ||
    process.env[stripePriceEnvKey(plan, billingCycle)] ||
    process.env.STRIPE_PRICE_ID_MONTHLY_1000 ||
    ''
  if (!priceId) {
    throw new Error(
      `Missing ${optionAwarePriceKey} (or ${stripePriceEnvKey(plan, billingCycle)} / ${stripeAdditionalPriceEnvKey(plan, billingCycle)} / STRIPE_PRICE_ID_MONTHLY_1000).`
    )
  }
  const subscription = await postStripeForm<StripeSubscription>('subscriptions', {
    customer: customerId,
    'items[0][price]': priceId,
    collection_method: 'charge_automatically',
    'metadata[provider]': 'stripe',
    'metadata[plan]': plan,
    'metadata[billing_cycle]': billingCycle,
    'metadata[hotel_option_enabled]': optionMetadata(options).hotel_option_enabled,
    'metadata[notification_option_enabled]': optionMetadata(options).notification_option_enabled,
  })
  return subscription
}

export async function createKomojuCheckoutSession({
  customerId,
  returnUrl,
  plan,
  billingCycle,
  storeId,
  userId,
  amountJpy,
  useAdditionalStorePricing,
  options,
}: {
  customerId: string
  returnUrl: string
  plan: AppPlan
  billingCycle: BillingCycle
  storeId: string
  userId: string
  amountJpy: number
  useAdditionalStorePricing?: boolean
  options: SubscriptionOptionPricingInput
}) {
  const optionAwareProductKey = komojuSubscriptionProductEnvKey(
    plan,
    billingCycle,
    options,
    useAdditionalStorePricing
  )
  const fallbackAdditionalProductId = useAdditionalStorePricing
    ? process.env[komojuAdditionalProductEnvKey(plan, billingCycle)] ?? ''
    : ''
  const productId =
    process.env[optionAwareProductKey] ||
    fallbackAdditionalProductId ||
    process.env[komojuProductEnvKey(plan, billingCycle)] ||
    process.env.KOMOJU_PRODUCT_ID_MONTHLY_1000 ||
    ''
  if (!productId) {
    throw new Error(
      `Missing ${optionAwareProductKey} (or ${komojuProductEnvKey(plan, billingCycle)} / ${komojuAdditionalProductEnvKey(plan, billingCycle)} / KOMOJU_PRODUCT_ID_MONTHLY_1000).`
    )
  }
  const allowedTypes = (process.env.KOMOJU_ALLOWED_PAYMENT_TYPES ?? 'konbini,carrier_payment')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const session = await postKomojuJson<KomojuCheckoutSession>('/v1/checkout_sessions', {
    mode: 'subscription',
    product_id: productId,
    customer: customerId,
    return_url: returnUrl,
    payment_types: allowedTypes,
    metadata: {
      provider: 'komoju',
      store_id: storeId,
      user_id: userId,
      plan,
      billing_cycle: billingCycle,
      amount_jpy: Math.max(0, Math.round(amountJpy)),
      ...optionMetadata(options),
    },
  })
  if (!session.url) {
    throw new Error('KOMOJU checkout URL is empty.')
  }
  return session
}

export async function createKomojuSubscription({
  customerId,
  plan,
  billingCycle,
  useAdditionalStorePricing,
  options,
}: {
  customerId: string
  plan: AppPlan
  billingCycle: BillingCycle
  useAdditionalStorePricing?: boolean
  options: SubscriptionOptionPricingInput
}) {
  const optionAwareProductKey = komojuSubscriptionProductEnvKey(
    plan,
    billingCycle,
    options,
    useAdditionalStorePricing
  )
  const fallbackAdditionalProductId = useAdditionalStorePricing
    ? process.env[komojuAdditionalProductEnvKey(plan, billingCycle)] ?? ''
    : ''
  const productId =
    process.env[optionAwareProductKey] ||
    fallbackAdditionalProductId ||
    process.env[komojuProductEnvKey(plan, billingCycle)] ||
    process.env.KOMOJU_PRODUCT_ID_MONTHLY_1000 ||
    ''
  if (!productId) {
    throw new Error(
      `Missing ${optionAwareProductKey} (or ${komojuProductEnvKey(plan, billingCycle)} / ${komojuAdditionalProductEnvKey(plan, billingCycle)} / KOMOJU_PRODUCT_ID_MONTHLY_1000).`
    )
  }
  const subscription = await postKomojuJson<KomojuSubscription>('/v1/subscriptions', {
    customer: customerId,
    product_id: productId,
    metadata: {
      provider: 'komoju',
      plan,
      billing_cycle: billingCycle,
      ...optionMetadata(options),
    },
  })
  return subscription
}

export async function createStripeStorageAddonCheckoutSession(params: {
  customerId: string
  successUrl: string
  cancelUrl: string
  storeId: string
  userId: string
  addonGb: number
  amountJpy: number
  units: number
}) {
  const priceKey = stripeStorageAddonPriceEnvKey(params.addonGb)
  const priceId = process.env[priceKey] || ''
  if (!priceId) {
    throw new Error(`Missing ${priceKey}.`)
  }
  const session = await postStripeForm<StripeCheckoutSession>('checkout/sessions', {
    mode: 'subscription',
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    'metadata[store_id]': params.storeId,
    'metadata[user_id]': params.userId,
    'metadata[operation_type]': 'storage_addon',
    'metadata[subscription_scope]': 'storage_addon',
    'metadata[storage_addon_gb]': params.addonGb,
    'metadata[storage_addon_units]': params.units,
    'metadata[amount_jpy]': Math.max(0, Math.round(params.amountJpy)),
    'subscription_data[metadata][provider]': 'stripe',
    'subscription_data[metadata][store_id]': params.storeId,
    'subscription_data[metadata][user_id]': params.userId,
    'subscription_data[metadata][operation_type]': 'storage_addon',
    'subscription_data[metadata][subscription_scope]': 'storage_addon',
    'subscription_data[metadata][storage_addon_gb]': params.addonGb,
    'subscription_data[metadata][storage_addon_units]': params.units,
    'subscription_data[metadata][amount_jpy]': Math.max(0, Math.round(params.amountJpy)),
  })
  if (!session.url) {
    throw new Error('Stripe checkout URL is empty.')
  }
  return session
}

export async function createKomojuStorageAddonCheckoutSession(params: {
  customerId: string
  returnUrl: string
  storeId: string
  userId: string
  addonGb: number
  amountJpy: number
  units: number
}) {
  const productKey = komojuStorageAddonProductEnvKey(params.addonGb)
  const productId = process.env[productKey] || ''
  if (!productId) {
    throw new Error(`Missing ${productKey}.`)
  }
  const allowedTypes = (process.env.KOMOJU_ALLOWED_PAYMENT_TYPES ?? 'konbini,carrier_payment')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const session = await postKomojuJson<KomojuCheckoutSession>('/v1/checkout_sessions', {
    mode: 'subscription',
    product_id: productId,
    customer: params.customerId,
    return_url: params.returnUrl,
    payment_types: allowedTypes,
    metadata: {
      provider: 'komoju',
      store_id: params.storeId,
      user_id: params.userId,
      operation_type: 'storage_addon',
      subscription_scope: 'storage_addon',
      storage_addon_gb: params.addonGb,
      storage_addon_units: params.units,
      amount_jpy: Math.max(0, Math.round(params.amountJpy)),
    },
  })
  if (!session.url) {
    throw new Error('KOMOJU checkout URL is empty.')
  }
  return session
}

export async function createStripeOneTimeCheckoutSession(params: {
  customerId: string
  successUrl: string
  cancelUrl: string
  amountJpy: number
  itemName: string
  storeId: string
  userId: string
  metadata?: Record<string, string>
}) {
  const normalizedAmount = Math.max(0, Math.round(params.amountJpy))
  if (normalizedAmount <= 0) {
    throw new Error('amount_jpy must be greater than 0.')
  }
  const metadata = params.metadata ?? {}
  const payload: Record<string, string | number | boolean | null | undefined> = {
    mode: 'payment',
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'jpy',
    'line_items[0][price_data][unit_amount]': normalizedAmount,
    'line_items[0][price_data][product_data][name]': params.itemName,
    'metadata[operation_type]': metadata.operation_type ?? 'setup_assistance',
    'metadata[store_id]': params.storeId,
    'metadata[user_id]': params.userId,
  }
  Object.entries(metadata).forEach(([key, value]) => {
    payload[`metadata[${key}]`] = value
  })
  const session = await postStripeForm<StripeOneTimeCheckoutSession>('checkout/sessions', payload)
  if (!session.url) {
    throw new Error('Stripe checkout URL is empty.')
  }
  return session
}

export async function createKomojuOneTimeCheckoutSession(params: {
  customerId: string
  returnUrl: string
  amountJpy: number
  itemName: string
  storeId: string
  userId: string
  metadata?: Record<string, string>
}) {
  const normalizedAmount = Math.max(0, Math.round(params.amountJpy))
  if (normalizedAmount <= 0) {
    throw new Error('amount_jpy must be greater than 0.')
  }
  const allowedTypes = (process.env.KOMOJU_ALLOWED_PAYMENT_TYPES ?? 'konbini,carrier_payment')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const session = await postKomojuJson<KomojuCheckoutSession>('/v1/checkout_sessions', {
    mode: 'payment',
    amount: normalizedAmount,
    currency: 'JPY',
    customer: params.customerId,
    return_url: params.returnUrl,
    payment_types: allowedTypes,
    metadata: {
      provider: 'komoju',
      operation_type: params.metadata?.operation_type ?? 'setup_assistance',
      item_name: params.itemName,
      store_id: params.storeId,
      user_id: params.userId,
      ...(params.metadata ?? {}),
    },
  })
  if (!session.url) {
    throw new Error('KOMOJU checkout URL is empty.')
  }
  return session
}

export async function fetchStripeSubscription(subscriptionId: string) {
  return getStripe<StripeSubscription>(`subscriptions/${subscriptionId}`)
}

export async function cancelStripeSubscription(params: {
  subscriptionId: string
  immediately: boolean
}) {
  if (params.immediately) {
    return deleteStripe<StripeCanceledSubscription>(`subscriptions/${params.subscriptionId}`)
  }
  return postStripeForm<StripeCanceledSubscription>(`subscriptions/${params.subscriptionId}`, {
    cancel_at_period_end: true,
  })
}

export async function fetchKomojuSubscription(subscriptionId: string) {
  return getKomoju<KomojuSubscription>(`/v1/subscriptions/${subscriptionId}`)
}

export async function cancelKomojuSubscription(params: {
  subscriptionId: string
  immediately: boolean
}) {
  return postKomojuJson<KomojuSubscription>(`/v1/subscriptions/${params.subscriptionId}/cancel`, {
    immediate: params.immediately,
  })
}

export async function createProviderCustomer({
  provider,
  email,
  storeId,
  userId,
}: {
  provider: BillingProvider
  email: string
  storeId: string
  userId: string
}) {
  if (provider === 'stripe') {
    return createStripeCustomer({ email, storeId, userId })
  }
  const result = await postKomojuJson<{ id: string }>('/v1/customers', {
    email,
    metadata: { store_id: storeId, user_id: userId },
  })
  return result.id
}
