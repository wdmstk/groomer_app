import { NextResponse } from 'next/server'
import {
  findBillingSubscriptionByProviderSubscriptionId,
  insertBillingWebhookEvent,
  markBillingWebhookEventResult,
} from '@/lib/billing/db'
import { verifyKomojuSignature } from '@/lib/billing/webhooks'
import { processKomojuBillingEvent, type KomojuWebhookEvent } from '@/lib/billing/webhook-event-processors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function extractSubscriptionId(event: KomojuWebhookEvent) {
  return event.data?.subscription_id ?? event.data?.subscription?.id ?? null
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

  const event = JSON.parse(payload) as KomojuWebhookEvent
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
  try {
    await processKomojuBillingEvent(event)
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
