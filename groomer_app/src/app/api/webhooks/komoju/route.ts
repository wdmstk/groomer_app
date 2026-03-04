import { NextResponse } from 'next/server'
import {
  findBillingSubscriptionByProviderSubscriptionId,
  insertBillingWebhookEvent,
  markBillingWebhookEventResult,
  updateStoreSubscriptionStatus,
  updateSubscriptionStatusByProviderSubscriptionId,
} from '@/lib/billing/db'
import { verifyKomojuSignature } from '@/lib/billing/webhooks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type KomojuEvent = {
  id?: string
  type: string
  data?: {
    subscription_id?: string
    subscription?: {
      id?: string
      current_period_end?: string
    }
    current_period_end?: string
  }
}

function extractSubscriptionId(event: KomojuEvent) {
  return event.data?.subscription_id ?? event.data?.subscription?.id ?? null
}

function extractPeriodEnd(event: KomojuEvent) {
  return event.data?.subscription?.current_period_end ?? event.data?.current_period_end ?? null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.KOMOJU_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ message: 'Missing KOMOJU_WEBHOOK_SECRET' }, { status: 500 })
  }

  const payload = await request.text()
  const signature = request.headers.get('x-komoju-signature')
  const valid = await verifyKomojuSignature({
    payload,
    header: signature,
    secret: webhookSecret,
  })
  if (!valid) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(payload) as KomojuEvent
  const subscriptionId = extractSubscriptionId(event)
  const resolvedSubscription = subscriptionId
    ? await findBillingSubscriptionByProviderSubscriptionId({
        provider: 'komoju',
        providerSubscriptionId: subscriptionId,
      })
    : null
  const logId = await insertBillingWebhookEvent({
    storeId: resolvedSubscription?.store_id ?? null,
    provider: 'komoju',
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
    if (event.type === 'payment.succeeded') {
      const row = await updateSubscriptionStatusByProviderSubscriptionId({
        provider: 'komoju',
        providerSubscriptionId: subscriptionId,
        status: 'active',
        currentPeriodEnd: extractPeriodEnd(event),
      })
      if (row) {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'active',
          provider: 'komoju',
          currentPeriodEnd: extractPeriodEnd(event),
          source: 'webhook',
          reason: event.type,
        })
      }
    }

    if (event.type === 'payment.failed') {
      const row = await updateSubscriptionStatusByProviderSubscriptionId({
        provider: 'komoju',
        providerSubscriptionId: subscriptionId,
        status: 'past_due',
        currentPeriodEnd: extractPeriodEnd(event),
      })
      if (row) {
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
        currentPeriodEnd: extractPeriodEnd(event),
      })
      if (row) {
        await updateStoreSubscriptionStatus({
          storeId: row.store_id,
          status: 'canceled',
          provider: 'komoju',
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
