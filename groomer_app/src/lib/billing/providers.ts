import type { BillingProvider } from './types'

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

async function postKomojuJson<T>(path: string, payload: Record<string, unknown>) {
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
}: {
  customerId: string
  successUrl: string
  cancelUrl: string
}) {
  const priceId = requireEnv('STRIPE_PRICE_ID_MONTHLY_1000')
  const session = await postStripeForm<StripeCheckoutSession>('checkout/sessions', {
    mode: 'subscription',
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    'subscription_data[metadata][provider]': 'stripe',
    'subscription_data[metadata][plan]': 'monthly_1000',
  })
  if (!session.url) {
    throw new Error('Stripe checkout URL is empty.')
  }
  return session
}

export async function createStripeSubscription({
  customerId,
}: {
  customerId: string
}) {
  const priceId = requireEnv('STRIPE_PRICE_ID_MONTHLY_1000')
  const subscription = await postStripeForm<StripeSubscription>('subscriptions', {
    customer: customerId,
    'items[0][price]': priceId,
    collection_method: 'charge_automatically',
    'metadata[provider]': 'stripe',
    'metadata[plan]': 'monthly_1000',
  })
  return subscription
}

export async function createKomojuCheckoutSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  const productId = requireEnv('KOMOJU_PRODUCT_ID_MONTHLY_1000')
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
      plan: 'monthly_1000',
    },
  })
  if (!session.url) {
    throw new Error('KOMOJU checkout URL is empty.')
  }
  return session
}

export async function createKomojuSubscription({
  customerId,
}: {
  customerId: string
}) {
  const productId = requireEnv('KOMOJU_PRODUCT_ID_MONTHLY_1000')
  const subscription = await postKomojuJson<KomojuSubscription>('/v1/subscriptions', {
    customer: customerId,
    product_id: productId,
    metadata: {
      provider: 'komoju',
      plan: 'monthly_1000',
    },
  })
  return subscription
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
