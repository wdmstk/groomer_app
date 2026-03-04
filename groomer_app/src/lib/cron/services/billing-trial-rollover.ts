import { createKomojuSubscription, createStripeSubscription } from '@/lib/billing/providers'
import { upsertBillingSubscription, updateStoreSubscriptionStatus } from '@/lib/billing/db'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type ExpiredTrialRow = {
  store_id: string
  trial_started_at: string | null
  trial_days: number | null
  preferred_provider: 'stripe' | 'komoju' | null
}

type BillingCustomerRow = {
  id: string
  provider_customer_id: string
}

function isExpiredTrial(trialStartedAt: string | null, trialDays: number | null) {
  if (!trialStartedAt) return false
  const days = Math.max(0, trialDays ?? 30)
  const start = new Date(`${trialStartedAt}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return false
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + days)
  const now = new Date()
  return now >= end
}

export async function runBillingTrialRolloverJob() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_subscriptions')
    .select('store_id, trial_started_at, trial_days, preferred_provider')
    .eq('billing_status', 'trialing')

  if (error) {
    throw new Error(error.message)
  }

  const trialRows = ((data ?? []) as ExpiredTrialRow[]).filter((row) =>
    isExpiredTrial(row.trial_started_at, row.trial_days)
  )
  let activated = 0
  let failed = 0
  const activatedStoreIds = new Set<string>()
  const failedStoreIds = new Set<string>()

  for (const row of trialRows) {
    try {
      if (!row.preferred_provider) {
        failed += 1
        failedStoreIds.add(row.store_id)
        continue
      }

      const { data: customer, error: customerError } = await admin
        .from('billing_customers')
        .select('id, provider_customer_id')
        .eq('store_id', row.store_id)
        .eq('provider', row.preferred_provider)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (customerError || !customer) {
        failed += 1
        failedStoreIds.add(row.store_id)
        continue
      }

      const billingCustomer = customer as BillingCustomerRow
      if (row.preferred_provider === 'stripe') {
        const stripeSub = await createStripeSubscription({
          customerId: billingCustomer.provider_customer_id,
        })
        const periodEnd =
          stripeSub.current_period_end && Number.isFinite(stripeSub.current_period_end)
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : null
        await upsertBillingSubscription({
          storeId: row.store_id,
          provider: 'stripe',
          billingCustomerId: billingCustomer.id,
          providerSubscriptionId: stripeSub.id,
          status: 'active',
          currentPeriodEnd: periodEnd,
        })
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'stripe',
          currentPeriodEnd: periodEnd,
          source: 'cron',
          reason: 'trial_rollover_auto_charge',
        })
      } else {
        const komojuSub = await createKomojuSubscription({
          customerId: billingCustomer.provider_customer_id,
        })
        await upsertBillingSubscription({
          storeId: row.store_id,
          provider: 'komoju',
          billingCustomerId: billingCustomer.id,
          providerSubscriptionId: komojuSub.id,
          status: 'active',
          currentPeriodEnd: komojuSub.current_period_end,
        })
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'komoju',
          currentPeriodEnd: komojuSub.current_period_end,
          source: 'cron',
          reason: 'trial_rollover_auto_charge',
        })
      }
      activated += 1
      activatedStoreIds.add(row.store_id)
    } catch {
      failed += 1
      failedStoreIds.add(row.store_id)
    }
  }

  return {
    scanned: trialRows.length,
    activated,
    failed,
    counters: {
      scanned: trialRows.length,
      activated,
      failed,
    },
    activatedStoreIds: Array.from(activatedStoreIds),
    failedStoreIds: Array.from(failedStoreIds),
  }
}
