import { NextResponse } from 'next/server'
import {
  findBillingSubscriptionByProviderSubscriptionId,
  insertBillingWebhookEvent,
  markBillingWebhookEventResult,
} from '@/lib/billing/db'
import { verifyKomojuSignature } from '@/lib/billing/webhooks'
import { processKomojuBillingEvent, type KomojuWebhookEvent } from '@/lib/billing/webhook-event-processors'
import { listActiveProviderWebhookSecrets } from '@/lib/billing/provider-connections'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function extractSubscriptionId(event: KomojuWebhookEvent) {
  return event.data?.subscription_id ?? event.data?.subscription?.id ?? null
}

export async function POST(request: Request) {
  const payload = await request.text()
  const signature = request.headers.get('x-komoju-signature')
  const configuredSecrets = [
    process.env.KOMOJU_WEBHOOK_SECRET ?? '',
    ...(await listActiveProviderWebhookSecrets('komoju')),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
  const uniqueSecrets = Array.from(new Set(configuredSecrets))
  if (uniqueSecrets.length === 0) {
    return NextResponse.json({ message: 'Missing KOMOJU webhook secrets' }, { status: 500 })
  }

  let valid = false
  for (const secret of uniqueSecrets) {
    const matched = await verifyKomojuSignature({
      payload,
      header: signature,
      secret,
    })
    if (matched) {
      valid = true
      break
    }
  }
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
