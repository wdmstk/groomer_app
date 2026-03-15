import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { type LineWebhookEvent, type LineWebhookPayload, verifyLineSignature } from '@/lib/line-webhooks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getLineUserId(event: LineWebhookEvent) {
  return typeof event.source?.userId === 'string' ? event.source.userId : null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.LINE_CHANNEL_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ message: 'Missing LINE_CHANNEL_SECRET' }, { status: 500 })
  }

  const payloadText = await request.text()
  const signature = request.headers.get('x-line-signature')
  const isValid = await verifyLineSignature({
    payload: payloadText,
    header: signature,
    secret: webhookSecret,
  })
  if (!isValid) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(payloadText) as LineWebhookPayload
  const events = Array.isArray(payload.events) ? payload.events : []
  if (events.length === 0) {
    return NextResponse.json({ received: true, count: 0 })
  }

  const adminSupabase = createAdminSupabaseClient() as any
  const lineUserIds = Array.from(
    new Set(events.map((event) => getLineUserId(event)).filter((value): value is string => Boolean(value)))
  )
  const customerRows =
    lineUserIds.length > 0
      ? (
          await adminSupabase
            .from('customers')
            .select('id, store_id, line_id')
            .in('line_id', lineUserIds)
        ).data ?? []
      : []

  const customerByLineId = new Map<string, { id: string; store_id: string | null }>()
  for (const customer of customerRows as Array<{ id: string; store_id: string | null; line_id: string | null }>) {
    if (typeof customer.line_id === 'string' && !customerByLineId.has(customer.line_id)) {
      customerByLineId.set(customer.line_id, {
        id: customer.id,
        store_id: customer.store_id,
      })
    }
  }

  const rows = events.map((event) => {
    const lineUserId = getLineUserId(event)
    const matchedCustomer = lineUserId ? customerByLineId.get(lineUserId) ?? null : null
    return {
      store_id: matchedCustomer?.store_id ?? null,
      matched_customer_id: matchedCustomer?.id ?? null,
      line_user_id: lineUserId,
      destination: typeof payload.destination === 'string' ? payload.destination : null,
      event_type: typeof event.type === 'string' ? event.type : 'unknown',
      event_id: typeof event.webhookEventId === 'string' ? event.webhookEventId : null,
      signature,
      status: matchedCustomer ? 'linked' : 'received',
      payload: event,
    }
  })

  const { error } = await adminSupabase.from('line_webhook_events').upsert(rows, {
    onConflict: 'event_id',
    ignoreDuplicates: false,
  })
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    received: true,
    count: rows.length,
    linkedCount: rows.filter((row) => row.matched_customer_id).length,
  })
}
