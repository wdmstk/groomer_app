import { NextResponse } from 'next/server'
import {
  findBillingSubscriptionByProviderSubscriptionId,
  insertBillingWebhookEvent,
  markBillingWebhookEventResult,
} from '@/lib/billing/db'
import { verifyStripeSignature } from '@/lib/billing/webhooks'
import { processStripeBillingEvent, type StripeWebhookEvent } from '@/lib/billing/webhook-event-processors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const event = JSON.parse(payload) as StripeWebhookEvent
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
  try {
    await processStripeBillingEvent(event)
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
