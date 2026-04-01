import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { requireJournalStoreContext } from '@/lib/journal/api-guard'
import { requireJournalPermission } from '@/lib/journal/permissions'

type RouteParams = {
  params: Promise<{
    entry_id: string
  }>
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  const canPublish = requireJournalPermission(guard.permissions, 'canPublish')
  if (!canPublish.ok) {
    return NextResponse.json({ message: canPublish.message }, { status: canPublish.status })
  }

  const { entry_id: entryId } = await params
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw) ?? {}

  const channel = parseOptionalString(body.channel) ?? 'line'
  const recipientCustomerId = parseOptionalString(body.recipient_customer_id)

  const { data: entry, error: entryError } = await guard.supabase
    .from('journal_entries')
    .select('id, customer_id, status')
    .eq('store_id', guard.storeId)
    .eq('id', entryId)
    .maybeSingle()

  if (entryError) {
    return NextResponse.json({ message: entryError.message }, { status: 500 })
  }
  if (!entry) {
    return NextResponse.json({ message: 'Journal entry not found.' }, { status: 404 })
  }

  const targetCustomerId = recipientCustomerId ?? (entry.customer_id as string | null)
  if (!targetCustomerId) {
    return NextResponse.json({ message: 'recipient_customer_id is required.' }, { status: 400 })
  }

  const { data: notification, error: notificationError } = await guard.supabase
    .from('journal_notifications')
    .insert({
      store_id: guard.storeId,
      entry_id: entryId,
      channel,
      recipient_customer_id: targetCustomerId,
      status: 'queued',
    })
    .select('id, status, created_at')
    .single()

  if (notificationError || !notification) {
    return NextResponse.json(
      { message: notificationError?.message ?? 'Failed to queue notification.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    notification_id: notification.id,
    status: notification.status,
  })
}
