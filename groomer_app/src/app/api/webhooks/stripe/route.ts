import { NextResponse } from 'next/server'
import {
  findBillingSubscriptionByProviderSubscriptionId,
  insertBillingWebhookEvent,
  markBillingWebhookEventResult,
  updateStoreSubscriptionStatus,
  updateSubscriptionStatusByProviderSubscriptionId,
} from '@/lib/billing/db'
import { verifyStripeSignature } from '@/lib/billing/webhooks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type StripeEvent = {
  id?: string
  type: string
  data?: {
    object?: {
      customer?: string
      subscription?: string
      status?: string
      current_period_end?: number
    }
  }
}

function toIsoFromUnixSeconds(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return null
  return new Date(value * 1000).toISOString()
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ message: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })
  }

  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')
  const valid = await verifyStripeSignature({
    payload,
    header: signature,
    secret: webhookSecret,
  })
  if (!valid) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(payload) as StripeEvent
  const subscriptionId = event.data?.object?.subscription
  const resolvedSubscription = subscriptionId
    ? await findBillingSubscriptionByProviderSubscriptionId({
        provider: 'stripe',
        providerSubscriptionId: subscriptionId,
      })
    : null
  const logId = await insertBillingWebhookEvent({
    storeId: resolvedSubscription?.store_id ?? null,
    provider: 'stripe',
    eventType: event.type ?? 'unknown',
    eventId: event.id ?? null,
    signature,
    payload: event,
  })
  if (!subscriptionId) {
    await markBillingWebhookEventResult({ id: logId, status: 'processed' })
    return NextResponse.json({ received: true })
  }

  try {
    if (event.type === 'invoice.payment_succeeded') {
      const row = await updateSubscriptionStatusByProviderSubscriptionId({
        provider: 'stripe',
        providerSubscriptionId: subscriptionId,
        status: 'active',
        currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
      })
      if (row) {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'stripe',
          currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
          source: 'webhook',
          reason: event.type,
        })
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const row = await updateSubscriptionStatusByProviderSubscriptionId({
        provider: 'stripe',
        providerSubscriptionId: subscriptionId,
        status: 'past_due',
        currentPeriodEnd: toIsoFromUnixSeconds(event.data?.object?.current_period_end),
      })
      if (row) {
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
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'canceled',
          provider: 'stripe',
          source: 'webhook',
          reason: event.type,
        })
      }
    }
    await markBillingWebhookEventResult({ id: logId, status: 'processed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook process failed.'
    await markBillingWebhookEventResult({
      id: logId,
      status: 'failed',
      errorMessage: message,
    })
    return NextResponse.json({ message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
