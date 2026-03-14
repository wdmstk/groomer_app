import {
  hasBillingOperation,
  insertBillingOperation,
  markCheckoutSessionCompleted,
  updateStoreSubscriptionStatus,
  updateSubscriptionStatusByProviderSubscriptionId,
} from '@/lib/billing/db'
import { setStoreExtraCapacityGb } from '@/lib/storage-quota'
import { normalizePlanCode, type AppPlan } from '@/lib/subscription-plan'
import { parseBillingCycle, type BillingCycle } from '@/lib/billing/pricing'

export type StripeWebhookEvent = {
  id?: string
  type: string
  data?: {
    object?: {
      subscription?: string
      current_period_end?: number
      id?: string
      mode?: string
      payment_status?: string
      metadata?: Record<string, string | undefined>
      amount_paid?: number
    }
  }
}

export type KomojuWebhookEvent = {
  id?: string
  type: string
  data?: {
    subscription_id?: string
    subscription?: {
      id?: string
      current_period_end?: string
    }
    current_period_end?: string
    metadata?: Record<string, string | undefined>
    payment?: {
      id?: string
      amount?: number
      metadata?: Record<string, string | undefined>
    }
  }
}

function toIsoFromUnixSeconds(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return null
  return new Date(value * 1000).toISOString()
}

function extractKomojuSubscriptionId(event: KomojuWebhookEvent) {
  return event.data?.subscription_id ?? event.data?.subscription?.id ?? null
}

function extractKomojuPeriodEnd(event: KomojuWebhookEvent) {
  return event.data?.subscription?.current_period_end ?? event.data?.current_period_end ?? null
}

function parsePlanFromMetadata(metadata: Record<string, string | undefined> | undefined): AppPlan | undefined {
  const raw = metadata?.plan
  if (!raw) return undefined
  return normalizePlanCode(raw)
}

function parseBillingCycleFromMetadata(
  metadata: Record<string, string | undefined> | undefined
): BillingCycle | undefined {
  const raw = metadata?.billing_cycle
  if (!raw) return undefined
  return parseBillingCycle(raw)
}

function parseAmountFromMetadata(metadata: Record<string, string | undefined> | undefined): number | undefined {
  const raw = metadata?.amount_jpy
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, parsed)
}

function parseSubscriptionScopeFromMetadata(
  metadata: Record<string, string | undefined> | undefined
): 'core' | 'storage_addon' {
  return metadata?.subscription_scope === 'storage_addon' ? 'storage_addon' : 'core'
}

function parseStorageAddonUnitsFromMetadata(
  metadata: Record<string, string | undefined> | undefined
): number | undefined {
  const raw = metadata?.storage_addon_units
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, parsed)
}

export async function processStripeBillingEvent(event: StripeWebhookEvent) {
  const subscriptionId = event.data?.object?.subscription ?? null

  if (event.type === 'checkout.session.completed') {
    const object = event.data?.object
    const metadata = object?.metadata ?? {}
    if (object?.id) {
      await markCheckoutSessionCompleted({
        provider: 'stripe',
        checkoutSessionId: object.id,
      })
    }
    const checkoutResult = `checkout_session_id=${object?.id ?? 'unknown'}`
    const isSetupAssistance =
      object?.mode === 'payment' &&
      object?.payment_status === 'paid' &&
      metadata.operation_type === 'setup_assistance'
    if (isSetupAssistance && metadata.store_id) {
      const alreadyDone = await hasBillingOperation({
        storeId: metadata.store_id,
        provider: 'stripe',
        operationType: 'setup_assistance_paid',
        resultMessage: checkoutResult,
      })
      if (!alreadyDone) {
        await insertBillingOperation({
          storeId: metadata.store_id,
          provider: 'stripe',
          operationType: 'setup_assistance_paid',
          amountJpy: null,
          reason: 'stripe_checkout_session_completed',
          status: 'succeeded',
          resultMessage: checkoutResult,
        })
      }
    }

    const isSubscriptionCheckout = object?.mode === 'subscription' && Boolean(object?.subscription)
    if (isSubscriptionCheckout) {
      const planCode = parsePlanFromMetadata(metadata)
      const billingCycle = parseBillingCycleFromMetadata(metadata)
      const amountJpy = parseAmountFromMetadata(metadata)
      const subscriptionScope = parseSubscriptionScopeFromMetadata(metadata)
      const storageAddonUnits = parseStorageAddonUnitsFromMetadata(metadata)
      if (object?.subscription && (planCode || billingCycle || typeof amountJpy === 'number')) {
        const row = await updateSubscriptionStatusByProviderSubscriptionId({
          provider: 'stripe',
          providerSubscriptionId: object.subscription,
          status: 'active',
          storageAddonUnits,
          source: 'webhook',
          reason: event.type,
        })
        if (row) {
          if (subscriptionScope === 'storage_addon') {
            if ((storageAddonUnits ?? row.storage_addon_units ?? 0) > 0) {
              await setStoreExtraCapacityGb({
                storeId: row.store_id,
                extraCapacityGb: (storageAddonUnits ?? row.storage_addon_units ?? 0) * 10,
                updatedByUserId: metadata.user_id ?? null,
              })
            }
            const alreadyDone = await hasBillingOperation({
              storeId: row.store_id,
              provider: 'stripe',
              operationType: 'storage_addon_paid',
              resultMessage: checkoutResult,
            })
            if (!alreadyDone) {
              await insertBillingOperation({
                storeId: row.store_id,
                provider: 'stripe',
                providerSubscriptionId: object.subscription,
                operationType: 'storage_addon_paid',
                amountJpy: amountJpy ?? null,
                reason: `storage_addon_subscription_started_${(storageAddonUnits ?? row.storage_addon_units ?? 0) * 10}gb`,
                status: 'succeeded',
                resultMessage: checkoutResult,
              })
            }
          } else {
            await updateStoreSubscriptionStatus({
              storeId: row.store_id,
              status: 'active',
              provider: 'stripe',
              planCode,
              billingCycle,
              amountJpy,
              source: 'webhook',
              reason: event.type,
            })
          }
        }
      }
    }
  }

  if (!subscriptionId) {
    return { processedSubscription: false }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const metadata = event.data?.object?.metadata ?? {}
    const planCode = parsePlanFromMetadata(metadata)
    const billingCycle = parseBillingCycleFromMetadata(metadata)
    const amountJpy = parseAmountFromMetadata(metadata) ?? event.data?.object?.amount_paid
    const subscriptionScope = parseSubscriptionScopeFromMetadata(metadata)
    const storageAddonUnits = parseStorageAddonUnitsFromMetadata(metadata)
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'stripe',
      providerSubscriptionId: subscriptionId,
      status: 'active',
      storageAddonUnits,
      currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
    })
    if (row) {
      if (subscriptionScope === 'storage_addon') {
        await setStoreExtraCapacityGb({
          storeId: row.store_id,
          extraCapacityGb: (storageAddonUnits ?? row.storage_addon_units ?? 0) * 10,
        })
      } else {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'stripe',
          currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
          planCode,
          billingCycle,
          amountJpy,
          source: 'webhook',
          reason: event.type,
        })
      }
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'stripe',
      providerSubscriptionId: subscriptionId,
      status: 'past_due',
      currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
    })
    if (row && row.subscription_scope === 'core') {
      await updateStoreSubscriptionStatus({
        storeId: row.store_id,
        status: 'past_due',
        provider: 'stripe',
        source: 'webhook',
        reason: event.type,
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'stripe',
      providerSubscriptionId: subscriptionId,
      status: 'canceled',
      currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
    })
    if (row) {
      if (row.subscription_scope === 'storage_addon') {
        await setStoreExtraCapacityGb({
          storeId: row.store_id,
          extraCapacityGb: 0,
        })
      } else {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'canceled',
          provider: 'stripe',
          source: 'webhook',
          reason: event.type,
        })
      }
    }
  }

  return { processedSubscription: true }
}

export async function processKomojuBillingEvent(event: KomojuWebhookEvent) {
  const subscriptionId = extractKomojuSubscriptionId(event)

  if (event.type === 'payment.succeeded') {
    const metadata = event.data?.payment?.metadata ?? event.data?.metadata ?? {}
    const paymentResult = `payment_id=${event.data?.payment?.id ?? event.id ?? 'unknown'}`
    const isSetupAssistance = metadata.operation_type === 'setup_assistance'
    if (isSetupAssistance && metadata.store_id) {
      const alreadyDone = await hasBillingOperation({
        storeId: metadata.store_id,
        provider: 'komoju',
        operationType: 'setup_assistance_paid',
        resultMessage: paymentResult,
      })
      if (!alreadyDone) {
        await insertBillingOperation({
          storeId: metadata.store_id,
          provider: 'komoju',
          operationType: 'setup_assistance_paid',
          amountJpy: null,
          reason: 'komoju_payment_succeeded',
          status: 'succeeded',
          resultMessage: paymentResult,
        })
      }
    }

  }

  if (!subscriptionId) {
    return { processedSubscription: false }
  }

  if (event.type === 'payment.succeeded') {
    const metadata = event.data?.payment?.metadata ?? event.data?.metadata ?? {}
    const paymentResult = `payment_id=${event.data?.payment?.id ?? event.id ?? 'unknown'}`
    const planCode = parsePlanFromMetadata(metadata)
    const billingCycle = parseBillingCycleFromMetadata(metadata)
    const amountJpy = parseAmountFromMetadata(metadata) ?? event.data?.payment?.amount
    const subscriptionScope = parseSubscriptionScopeFromMetadata(metadata)
    const storageAddonUnits = parseStorageAddonUnitsFromMetadata(metadata)
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'komoju',
      providerSubscriptionId: subscriptionId,
      status: 'active',
      storageAddonUnits,
      currentPeriodEnd: extractKomojuPeriodEnd(event),
    })
    if (row) {
      if (subscriptionScope === 'storage_addon') {
        await setStoreExtraCapacityGb({
          storeId: row.store_id,
          extraCapacityGb: (storageAddonUnits ?? row.storage_addon_units ?? 0) * 10,
          updatedByUserId: metadata.user_id ?? null,
        })
        const alreadyDone = await hasBillingOperation({
          storeId: row.store_id,
          provider: 'komoju',
          operationType: 'storage_addon_paid',
          resultMessage: paymentResult,
        })
        if (!alreadyDone) {
          await insertBillingOperation({
            storeId: row.store_id,
            provider: 'komoju',
            providerSubscriptionId: subscriptionId,
            operationType: 'storage_addon_paid',
            amountJpy: amountJpy ?? null,
            reason: `storage_addon_subscription_started_${(storageAddonUnits ?? row.storage_addon_units ?? 0) * 10}gb`,
            status: 'succeeded',
            resultMessage: paymentResult,
          })
        }
      } else {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'komoju',
          currentPeriodEnd: extractKomojuPeriodEnd(event),
          planCode,
          billingCycle,
          amountJpy,
          source: 'webhook',
          reason: event.type,
        })
      }
    }
  }

  if (event.type === 'payment.failed') {
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'komoju',
      providerSubscriptionId: subscriptionId,
      status: 'past_due',
      currentPeriodEnd: extractKomojuPeriodEnd(event),
    })
    if (row && row.subscription_scope === 'core') {
      await updateStoreSubscriptionStatus({
        storeId: row.store_id,
        status: 'past_due',
        provider: 'komoju',
        source: 'webhook',
        reason: event.type,
      })
    }
  }

  if (event.type === 'subscription.canceled') {
    const row = await updateSubscriptionStatusByProviderSubscriptionId({
      provider: 'komoju',
      providerSubscriptionId: subscriptionId,
      status: 'canceled',
      currentPeriodEnd: extractKomojuPeriodEnd(event),
    })
    if (row) {
      if (row.subscription_scope === 'storage_addon') {
        await setStoreExtraCapacityGb({
          storeId: row.store_id,
          extraCapacityGb: 0,
        })
      } else {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'canceled',
          provider: 'komoju',
          source: 'webhook',
          reason: event.type,
        })
      }
    }
  }

  return { processedSubscription: true }
}
