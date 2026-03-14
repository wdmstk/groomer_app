import { fetchKomojuSubscription, fetchStripeSubscription } from '@/lib/billing/providers'
import { updateStoreSubscriptionStatus, updateSubscriptionStatusByProviderSubscriptionId } from '@/lib/billing/db'
import { setStoreExtraCapacityGb } from '@/lib/storage-quota'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type SubscriptionRow = {
  store_id: string
  provider: 'stripe' | 'komoju'
  provider_subscription_id: string | null
  storage_addon_units: number
  status: string
  subscription_scope: 'core' | 'storage_addon'
}

function mapStripeStatus(status: string): 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid' {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'active'
  if (status === 'past_due') return 'past_due'
  if (status === 'canceled') return 'canceled'
  if (status === 'unpaid') return 'unpaid'
  return 'incomplete'
}

function mapKomojuStatus(status: string): 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' {
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'failed') return 'past_due'
  if (status === 'canceled' || status === 'cancelled') return 'canceled'
  if (status === 'trialing') return 'trialing'
  return 'incomplete'
}

export async function runBillingStatusSyncJob() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('billing_subscriptions')
    .select('store_id, provider, provider_subscription_id, storage_addon_units, status, subscription_scope')
    .not('provider_subscription_id', 'is', null)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SubscriptionRow[]
  let synced = 0
  let failed = 0
  const affectedStoreIds = new Set<string>()
  const failedStoreIds = new Set<string>()
  let stripeCount = 0
  let komojuCount = 0

  for (const row of rows) {
    if (!row.provider_subscription_id) continue
    try {
      if (row.provider === 'stripe') {
        stripeCount += 1
        const remote = await fetchStripeSubscription(row.provider_subscription_id)
        const mapped = mapStripeStatus(remote.status)
        await updateSubscriptionStatusByProviderSubscriptionId({
          provider: 'stripe',
          providerSubscriptionId: row.provider_subscription_id,
          status: mapped,
          storageAddonUnits: row.storage_addon_units,
          currentPeriodEnd:
            remote.current_period_end && Number.isFinite(remote.current_period_end)
              ? new Date(remote.current_period_end * 1000).toISOString()
              : null,
          source: 'cron',
          reason: 'billing_status_sync',
        })
        if (row.subscription_scope === 'storage_addon') {
          await setStoreExtraCapacityGb({
            storeId: row.store_id,
            extraCapacityGb: mapped === 'canceled' ? 0 : row.storage_addon_units * 10,
          })
        } else {
          await updateStoreSubscriptionStatus({
            storeId: row.store_id,
            status:
              mapped === 'active'
                ? 'active'
                : mapped === 'past_due'
                  ? 'past_due'
                  : mapped === 'canceled'
                    ? 'canceled'
                    : 'trialing',
            provider: 'stripe',
            source: 'cron',
            reason: 'billing_status_sync',
          })
        }
      } else {
        komojuCount += 1
        const remote = await fetchKomojuSubscription(row.provider_subscription_id)
        const mapped = mapKomojuStatus(remote.status)
        await updateSubscriptionStatusByProviderSubscriptionId({
          provider: 'komoju',
          providerSubscriptionId: row.provider_subscription_id,
          status: mapped,
          storageAddonUnits: row.storage_addon_units,
          currentPeriodEnd: remote.current_period_end ?? null,
          source: 'cron',
          reason: 'billing_status_sync',
        })
        if (row.subscription_scope === 'storage_addon') {
          await setStoreExtraCapacityGb({
            storeId: row.store_id,
            extraCapacityGb: mapped === 'canceled' ? 0 : row.storage_addon_units * 10,
          })
        } else {
          await updateStoreSubscriptionStatus({
            storeId: row.store_id,
            status:
              mapped === 'active'
                ? 'active'
                : mapped === 'past_due'
                  ? 'past_due'
                  : mapped === 'canceled'
                    ? 'canceled'
                    : 'trialing',
            provider: 'komoju',
            source: 'cron',
            reason: 'billing_status_sync',
          })
        }
      }
      synced += 1
      affectedStoreIds.add(row.store_id)
    } catch {
      failed += 1
      failedStoreIds.add(row.store_id)
    }
  }

  return {
    scanned: rows.length,
    synced,
    failed,
    counters: {
      scanned: rows.length,
      synced,
      failed,
      stripe: stripeCount,
      komoju: komojuCount,
    },
    affectedStoreIds: Array.from(affectedStoreIds),
    failedStoreIds: Array.from(failedStoreIds),
  }
}
