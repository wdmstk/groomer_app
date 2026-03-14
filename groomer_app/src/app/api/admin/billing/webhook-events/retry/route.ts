import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import {
  findBillingWebhookEventById,
  markBillingWebhookEventResult,
} from '@/lib/billing/db'
import {
  processKomojuBillingEvent,
  processStripeBillingEvent,
  type KomojuWebhookEvent,
  type StripeWebhookEvent,
} from '@/lib/billing/webhook-event-processors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  const guard = await requireDeveloperAdmin()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const webhookEventId =
    typeof body?.webhookEventId === 'string' ? body.webhookEventId.trim() : ''
  if (!webhookEventId) {
    return NextResponse.json({ message: 'webhookEventId is required.' }, { status: 400 })
  }

  const eventLog = await findBillingWebhookEventById(webhookEventId)
  if (!eventLog) {
    return NextResponse.json({ message: 'Webhook event not found.' }, { status: 404 })
  }

  try {
    if (eventLog.provider === 'stripe') {
      await processStripeBillingEvent(eventLog.payload as StripeWebhookEvent)
    } else {
      await processKomojuBillingEvent(eventLog.payload as KomojuWebhookEvent)
    }
    await markBillingWebhookEventResult({
      id: eventLog.id,
      status: 'processed',
      errorMessage: null,
    })
    return NextResponse.json({
      message: 'Webhook event reprocessed.',
      webhookEventId: eventLog.id,
      provider: eventLog.provider,
      eventType: eventLog.event_type,
      status: 'processed',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook reprocess failed.'
    await markBillingWebhookEventResult({
      id: eventLog.id,
      status: 'failed',
      errorMessage: message,
    })
    return NextResponse.json({ message }, { status: 500 })
  }
}
