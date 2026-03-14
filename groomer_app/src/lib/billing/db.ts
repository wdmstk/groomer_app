import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { BillingCustomerRow, BillingProvider, BillingStatus, BillingSubscriptionRow } from './types'
import type { AppPlan } from '@/lib/subscription-plan'
import type { BillingCycle } from './pricing'
import type { Database, Json } from '@/lib/supabase/database.types'

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function findBillingCustomer({
  storeId,
  userId,
  provider,
}: {
  storeId: string
  userId: string
  provider: BillingProvider
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_customers')
    .select('id, store_id, user_id, provider, provider_customer_id, email')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data ?? null) as BillingCustomerRow | null
}

export async function upsertBillingCustomer(params: {
  storeId: string
  userId: string
  provider: BillingProvider
  providerCustomerId: string
  email: string | null
}) {
  const admin = createAdminSupabaseClient()
  const payload: Database['public']['Tables']['billing_customers']['Insert'] = {
    store_id: params.storeId,
    user_id: params.userId,
    provider: params.provider,
    provider_customer_id: params.providerCustomerId,
    email: params.email,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin
    .from('billing_customers')
    .upsert(payload, { onConflict: 'store_id,user_id,provider' })
    .select('id, store_id, user_id, provider, provider_customer_id, email')
    .single()
  if (error) throw new Error(error.message)
  return data as BillingCustomerRow
}

export async function upsertBillingSubscription(params: {
  storeId: string
  provider: BillingProvider
  billingCustomerId: string | null
  providerSubscriptionId: string | null
  subscriptionScope?: 'core' | 'storage_addon'
  storageAddonUnits?: number
  status: BillingStatus
  trialEnd?: string | null
  currentPeriodEnd?: string | null
}) {
  const admin = createAdminSupabaseClient()
  const { data: existing } = await admin
    .from('billing_subscriptions')
    .select('status')
    .eq('store_id', params.storeId)
    .eq('provider', params.provider)
    .eq('subscription_scope', params.subscriptionScope ?? 'core')
    .maybeSingle()
  const payload: Database['public']['Tables']['billing_subscriptions']['Insert'] = {
    store_id: params.storeId,
    provider: params.provider,
    billing_customer_id: params.billingCustomerId,
    provider_subscription_id: params.providerSubscriptionId,
    subscription_scope: params.subscriptionScope ?? 'core',
    storage_addon_units: Math.max(0, Math.floor(params.storageAddonUnits ?? 0)),
    status: params.status,
    trial_end: params.trialEnd ?? null,
    current_period_end: params.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('billing_subscriptions')
    .upsert(payload, { onConflict: 'store_id,provider,subscription_scope' })
    .select(
      'id, store_id, provider, billing_customer_id, provider_subscription_id, subscription_scope, storage_addon_units, status, trial_end, current_period_end'
    )
    .single()
  if (error) throw new Error(error.message)
  if ((existing?.status ?? null) !== params.status) {
    await insertBillingStatusHistory({
      storeId: params.storeId,
      provider: params.provider,
      fromStatus: existing?.status ?? null,
      toStatus: params.status,
      source: 'manual',
      reason: 'upsert_billing_subscription',
      providerSubscriptionId: params.providerSubscriptionId,
    })
  }
  return data as BillingSubscriptionRow
}

export async function updateSubscriptionStatusByProviderSubscriptionId(params: {
  provider: BillingProvider
  providerSubscriptionId: string
  status: BillingStatus
  currentPeriodEnd?: string | null
  storageAddonUnits?: number
  source?: 'checkout' | 'webhook' | 'cron' | 'manual'
  reason?: string
}) {
  const admin = createAdminSupabaseClient()
  const { data: existing } = await admin
    .from('billing_subscriptions')
    .select('id, store_id, provider, subscription_scope, storage_addon_units, status')
    .eq('provider', params.provider)
    .eq('provider_subscription_id', params.providerSubscriptionId)
    .maybeSingle()
  const payload: Database['public']['Tables']['billing_subscriptions']['Update'] = {
    status: params.status,
    current_period_end: params.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  }
  if (typeof params.storageAddonUnits === 'number' && Number.isFinite(params.storageAddonUnits)) {
    payload.storage_addon_units = Math.max(0, Math.floor(params.storageAddonUnits))
  }
  const { data, error } = await admin
    .from('billing_subscriptions')
    .update(payload)
    .eq('provider', params.provider)
    .eq('provider_subscription_id', params.providerSubscriptionId)
    .select('id, store_id, provider, subscription_scope, storage_addon_units')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing && existing.status !== params.status) {
    await insertBillingStatusHistory({
      storeId: existing.store_id,
      provider: params.provider,
      fromStatus: existing.status ?? null,
      toStatus: params.status,
      source: params.source ?? 'webhook',
      reason: params.reason ?? 'provider_webhook_status_update',
      providerSubscriptionId: params.providerSubscriptionId,
    })
  }
  return data as {
    id: string
    store_id: string
    provider: BillingProvider
    subscription_scope: 'core' | 'storage_addon'
    storage_addon_units: number
  } | null
}

export async function findBillingSubscriptionByProviderSubscriptionId(params: {
  provider: BillingProvider
  providerSubscriptionId: string
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_subscriptions')
    .select('id, store_id, provider, status')
    .eq('provider', params.provider)
    .eq('provider_subscription_id', params.providerSubscriptionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; store_id: string; provider: BillingProvider; status: string } | null
}

export async function findLatestBillingSubscriptionByStoreAndProvider(params: {
  storeId: string
  provider: BillingProvider
  subscriptionScope?: 'core' | 'storage_addon'
}) {
  const admin = createAdminSupabaseClient()
  let query = admin
    .from('billing_subscriptions')
    .select('id, store_id, provider, subscription_scope, storage_addon_units, status, provider_subscription_id, current_period_end')
    .eq('store_id', params.storeId)
    .eq('provider', params.provider)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (params.subscriptionScope) {
    query = query.eq('subscription_scope', params.subscriptionScope)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data as
    | {
        id: string
        store_id: string
        provider: BillingProvider
        subscription_scope: 'core' | 'storage_addon'
        storage_addon_units: number
        status: string
        provider_subscription_id: string | null
        current_period_end: string | null
      }
    | null
}

export async function updateStoreSubscriptionStatus(params: {
  storeId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'inactive'
  currentPeriodEnd?: string | null
  provider?: BillingProvider | null
  planCode?: AppPlan
  billingCycle?: BillingCycle
  amountJpy?: number
  source?: 'checkout' | 'webhook' | 'cron' | 'manual'
  reason?: string
}) {
  const admin = createAdminSupabaseClient()
  const { data: existing } = await admin
    .from('store_subscriptions')
    .select('billing_status, past_due_since')
    .eq('store_id', params.storeId)
    .maybeSingle()

  const payload: Database['public']['Tables']['store_subscriptions']['Update'] = {
    billing_status: params.status,
    current_period_end: params.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  }
  if (params.status === 'past_due') {
    payload.past_due_since = existing?.past_due_since ?? new Date().toISOString()
  } else {
    payload.past_due_since = null
  }
  if (params.provider) {
    payload.preferred_provider = params.provider
  }
  if (params.planCode) {
    payload.plan_code = params.planCode
  }
  if (params.billingCycle) {
    payload.billing_cycle = params.billingCycle
  }
  if (typeof params.amountJpy === 'number' && Number.isFinite(params.amountJpy)) {
    payload.amount_jpy = Math.max(0, Math.round(params.amountJpy))
  }
  const { error } = await admin
    .from('store_subscriptions')
    .upsert(
      {
        store_id: params.storeId,
        ...payload,
      },
      { onConflict: 'store_id' }
    )
  if (error) throw new Error(error.message)
  if ((existing?.billing_status ?? null) !== params.status) {
    await insertBillingStatusHistory({
      storeId: params.storeId,
      provider: params.provider ?? null,
      fromStatus: existing?.billing_status ?? null,
      toStatus: params.status,
      source: params.source ?? 'manual',
      reason: params.reason ?? 'update_store_subscription_status',
    })
  }
}

export async function insertBillingWebhookEvent(params: {
  storeId?: string | null
  provider: BillingProvider
  eventType: string
  eventId?: string | null
  signature?: string | null
  payload: unknown
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_webhook_events')
    .insert({
      store_id: params.storeId ?? null,
      provider: params.provider,
      event_type: params.eventType,
      event_id: params.eventId ?? null,
      signature: params.signature ?? null,
      payload: toJson(params.payload),
      status: 'received',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function markBillingWebhookEventResult(params: {
  id: string
  status: 'processed' | 'failed'
  errorMessage?: string | null
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('billing_webhook_events')
    .update({
      status: params.status,
      error_message: params.errorMessage ?? null,
    })
    .eq('id', params.id)
  if (error) throw new Error(error.message)
}

export async function findBillingWebhookEventById(id: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_webhook_events')
    .select('id, provider, event_type, payload, status, error_message')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as
    | {
        id: string
        provider: BillingProvider
        event_type: string
        payload: unknown
        status: 'received' | 'processed' | 'failed'
        error_message: string | null
      }
    | null
}

export async function findReusableCheckoutSession(params: {
  storeId: string
  userId: string
  provider: BillingProvider
  subscriptionScope?: 'core' | 'storage_addon'
}) {
  const admin = createAdminSupabaseClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('billing_checkout_sessions')
    .select('id, checkout_session_id, checkout_url, status, expires_at')
    .eq('store_id', params.storeId)
    .eq('user_id', params.userId)
    .eq('provider', params.provider)
    .eq('subscription_scope', params.subscriptionScope ?? 'core')
    .eq('status', 'created')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as
    | {
        id: string
        checkout_session_id: string | null
        checkout_url: string | null
        status: 'created'
        expires_at: string | null
      }
    | null
}

export async function createBillingCheckoutSessionLog(params: {
  storeId: string
  userId: string
  provider: BillingProvider
  subscriptionScope?: 'core' | 'storage_addon'
  idempotencyKey: string
  checkoutSessionId: string | null
  checkoutUrl: string | null
  expiresAt: string
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('billing_checkout_sessions')
    .upsert(
      {
        store_id: params.storeId,
        user_id: params.userId,
        provider: params.provider,
        subscription_scope: params.subscriptionScope ?? 'core',
        idempotency_key: params.idempotencyKey,
        checkout_session_id: params.checkoutSessionId,
        checkout_url: params.checkoutUrl,
        status: 'created',
        expires_at: params.expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,user_id,provider,subscription_scope,idempotency_key' }
    )
  if (error) throw new Error(error.message)
}

export async function markCheckoutSessionCompleted(params: {
  provider: BillingProvider
  checkoutSessionId: string
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('billing_checkout_sessions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('provider', params.provider)
    .eq('checkout_session_id', params.checkoutSessionId)
  if (error) throw new Error(error.message)
}

export async function insertBillingStatusHistory(params: {
  storeId: string
  provider?: BillingProvider | null
  fromStatus?: string | null
  toStatus: string
  source: 'checkout' | 'webhook' | 'cron' | 'manual'
  reason?: string | null
  providerSubscriptionId?: string | null
  payload?: unknown
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('billing_status_history').insert({
    store_id: params.storeId,
    provider: params.provider ?? null,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus,
    source: params.source,
    reason: params.reason ?? null,
    provider_subscription_id: params.providerSubscriptionId ?? null,
    payload: toJson(params.payload),
  })
  if (error) throw new Error(error.message)
}

export async function insertBillingOperation(params: {
  storeId: string
  provider: BillingProvider
  providerSubscriptionId?: string | null
  operationType:
    | 'cancel_immediately'
    | 'cancel_at_period_end'
    | 'refund_request'
    | 'setup_assistance_request'
    | 'setup_assistance_paid'
    | 'storage_addon_request'
    | 'storage_addon_paid'
    | 'notification_usage_billing_calculated'
  amountJpy?: number | null
  reason?: string | null
  status: 'requested' | 'succeeded' | 'failed'
  resultMessage?: string | null
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('billing_operations').insert({
    store_id: params.storeId,
    provider: params.provider,
    provider_subscription_id: params.providerSubscriptionId ?? null,
    operation_type: params.operationType,
    amount_jpy: params.amountJpy ?? null,
    reason: params.reason ?? null,
    status: params.status,
    result_message: params.resultMessage ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function hasBillingNotificationSent(params: {
  storeId: string
  kind: string
  target: string
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_notification_logs')
    .select('id')
    .eq('store_id', params.storeId)
    .eq('kind', params.kind)
    .eq('channel', 'email')
    .eq('target', params.target)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function logBillingNotification(params: {
  storeId: string
  kind: string
  target: string
}) {
  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('billing_notification_logs').insert({
    store_id: params.storeId,
    kind: params.kind,
    channel: 'email',
    target: params.target,
    sent_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function countActiveOwnerStores(userId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row) => row.store_id)).size
}

export async function hasBillingOperation(params: {
  storeId: string
  provider: BillingProvider
  operationType: string
  resultMessage: string
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_operations')
    .select('id')
    .eq('store_id', params.storeId)
    .eq('provider', params.provider)
    .eq('operation_type', params.operationType)
    .eq('result_message', params.resultMessage)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}
