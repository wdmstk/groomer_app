import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireStoreSupportTicketAccess } from '@/lib/auth/store-support-ticket'
import type { Database, Json } from '@/lib/supabase/database.types'
import { asJsonObjectOrNull } from '@/lib/object-utils'
import type { JsonObject } from '@/lib/object-utils'

type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
type TicketCategory = 'general' | 'bug' | 'billing' | 'feature_request' | 'account' | 'data_fix'
type TicketEventType =
  | 'ticket_created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'note_added'
  | 'resolved'
  | 'closed'
  | 'reopened'

type SupportTicketEventInsert = Database['public']['Tables']['support_ticket_events']['Insert']
type SupportTicketUpdate = Database['public']['Tables']['support_tickets']['Update']
function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

function toSafeText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return null
  return text.slice(0, maxLength)
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return ['low', 'normal', 'high', 'urgent'].includes(String(value))
}

function isTicketCategory(value: unknown): value is TicketCategory {
  return ['general', 'bug', 'billing', 'feature_request', 'account', 'data_fix'].includes(String(value))
}

export async function GET(request: Request) {
  const auth = await requireStoreSupportTicketAccess()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  const admin = createAdminSupabaseClient()

  let query = admin
    .from('support_tickets')
    .select(
      'id, ticket_no, created_at, updated_at, subject, description, category, priority, status, source, assigned_user_id, resolved_at, closed_at, last_activity_at'
    )
    .eq('store_id', auth.storeId)
    .order('last_activity_at', { ascending: false })
    .limit(200)

  if (statusParam && statusParam !== 'all') {
    query = query.eq('status', statusParam)
  }

  const { data: tickets, error: ticketsError } = await query
  if (ticketsError) {
    return NextResponse.json({ message: ticketsError.message }, { status: 500 })
  }

  const ticketIds = (tickets ?? []).map((ticket) => ticket.id)
  const { data: events, error: eventsError } =
    ticketIds.length > 0
      ? await admin
          .from('support_ticket_events')
          .select('id, ticket_id, actor_user_id, event_type, payload, created_at')
          .eq('store_id', auth.storeId)
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null }
  if (eventsError) {
    return NextResponse.json({ message: eventsError.message }, { status: 500 })
  }

  const eventsByTicketId = new Map<string, JsonObject[]>()
  for (const row of events ?? []) {
    const list = eventsByTicketId.get(row.ticket_id) ?? []
    list.push({
      id: row.id,
      actor_user_id: row.actor_user_id,
      event_type: row.event_type,
      payload: (row.payload ?? null) as Json,
      created_at: row.created_at,
    })
    eventsByTicketId.set(row.ticket_id, list)
  }

  const rows = (tickets ?? []).map((row) => ({
    ...row,
    events: eventsByTicketId.get(row.id) ?? [],
  }))

  return NextResponse.json({
    storeId: auth.storeId,
    currentUserId: auth.user.id,
    role: auth.role,
    tickets: rows,
  })
}

export async function POST(request: Request) {
  const auth = await requireStoreSupportTicketAccess()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const payloadRaw: unknown = await request.json().catch(() => null)
  const payload = asJsonObjectOrNull(payloadRaw)

  const subject = toSafeText(payload?.subject, 200)
  if (!subject) {
    return NextResponse.json({ message: '件名は必須です。' }, { status: 400 })
  }
  const description = toSafeText(payload?.description, 4000)
  const category = isTicketCategory(payload?.category) ? payload?.category : 'general'
  const priority = isTicketPriority(payload?.priority) ? payload?.priority : 'normal'

  const admin = createAdminSupabaseClient()
  const nowIso = new Date().toISOString()

  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .insert({
      store_id: auth.storeId,
      subject,
      description,
      category,
      priority,
      status: 'open',
      source: auth.role === 'owner' ? 'owner_portal' : 'staff_portal',
      created_by_user_id: auth.user.id,
      last_activity_at: nowIso,
      updated_at: nowIso,
    })
    .select(
      'id, ticket_no, created_at, updated_at, subject, description, category, priority, status, source, assigned_user_id, resolved_at, closed_at, last_activity_at'
    )
    .single()

  if (ticketError) {
    return NextResponse.json({ message: ticketError.message }, { status: 500 })
  }

  const eventPayload: SupportTicketEventInsert = {
    store_id: auth.storeId,
    ticket_id: ticket.id,
    actor_user_id: auth.user.id,
    event_type: 'ticket_created',
    payload: toJson({
      subject,
      category,
      priority,
      description,
      actor_role: auth.role,
      actor_scope: 'store',
    }),
  }

  const { error: eventError } = await admin.from('support_ticket_events').insert(eventPayload)

  if (eventError) {
    return NextResponse.json({ message: eventError.message }, { status: 500 })
  }

  return NextResponse.json({ ticket }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await requireStoreSupportTicketAccess()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const payloadRaw: unknown = await request.json().catch(() => null)
  const payload = asJsonObjectOrNull(payloadRaw)

  const ticketId = typeof payload?.ticket_id === 'string' ? payload.ticket_id : ''
  if (!ticketId) {
    return NextResponse.json({ message: 'ticket_id は必須です。' }, { status: 400 })
  }

  const comment = toSafeText(payload?.comment ?? payload?.note, 2000)
  if (!comment) {
    return NextResponse.json({ message: 'サポートにはコメント投稿のみ可能です。' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const updates: SupportTicketUpdate = {
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  }
  const { data: updated, error: updateError } = await admin
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .eq('store_id', auth.storeId)
    .select(
      'id, ticket_no, created_at, updated_at, subject, description, category, priority, status, source, assigned_user_id, resolved_at, closed_at, last_activity_at'
    )
    .single()

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  const notePayload: SupportTicketEventInsert = {
    store_id: auth.storeId,
    ticket_id: ticketId,
    actor_user_id: auth.user.id,
    event_type: 'note_added' satisfies TicketEventType,
    payload: toJson({ note: comment, comment, actor_role: auth.role, actor_scope: 'store' }),
  }

  const { error: eventError } = await admin.from('support_ticket_events').insert(notePayload)
  if (eventError) {
    return NextResponse.json({ message: eventError.message }, { status: 500 })
  }

  return NextResponse.json({ ticket: updated })
}
