import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export type BillingProvider = 'stripe' | 'komoju'

export type StorePaymentProviderConnection = {
  store_id: string
  provider: BillingProvider
  is_active: boolean
  secret_key: string | null
  webhook_secret: string | null
  komoju_api_base_url: string | null
}

export type StoreProviderCredentials = {
  secretKey: string
  webhookSecret: string | null
  komojuApiBaseUrl: string | null
}

export async function findStorePaymentProviderConnection(params: {
  storeId: string
  provider: BillingProvider
}) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_payment_provider_connections' as never)
    .select('store_id, provider, is_active, secret_key, webhook_secret, komoju_api_base_url')
    .eq('store_id', params.storeId)
    .eq('provider', params.provider)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') {
      return null
    }
    throw new Error(error.message)
  }
  return (data ?? null) as StorePaymentProviderConnection | null
}

export async function resolveActiveStoreProviderCredentials(params: {
  storeId: string
  provider: BillingProvider
}) {
  const row = await findStorePaymentProviderConnection(params)
  if (!row || !row.is_active || !row.secret_key) return null
  return {
    secretKey: row.secret_key,
    webhookSecret: row.webhook_secret,
    komojuApiBaseUrl: row.komoju_api_base_url,
  } satisfies StoreProviderCredentials
}

export async function listActiveProviderWebhookSecrets(provider: BillingProvider) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_payment_provider_connections' as never)
    .select('store_id, webhook_secret')
    .eq('provider', provider)
    .eq('is_active', true)
    .not('webhook_secret', 'is', null)

  if (error) {
    if (error.code === '42P01') {
      return []
    }
    throw new Error(error.message)
  }
  return ((data ?? []) as Array<{ store_id: string; webhook_secret: string | null }>)
    .map((row) => row.webhook_secret?.trim() ?? '')
    .filter(Boolean)
}

export function maskSecret(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  if (normalized.length <= 8) return '*'.repeat(normalized.length)
  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`
}
