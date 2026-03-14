import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/supabase/database.types'
import { asJsonObjectOrNull } from '@/lib/object-utils'
import type { JsonObject } from '@/lib/object-utils'

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
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

function isTicketStatus(value: unknown): value is TicketStatus {
  return ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'].includes(String(value))
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return ['low', 'normal', 'high', 'urgent'].includes(String(value))
}

function normalizeStoreId(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function ensureStoreExists(storeId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.from('stores').select('id').eq('id', storeId).maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  if (!data) return { ok: false as const, status: 404, message: '対象店舗が見つかりません。' }
  return { ok: true as const }
}

export async function GET(request: Request) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const storeId = normalizeStoreId(new URL(request.url).searchParams.get('store_id')) ?? ''
  if (!storeId) {
    return NextResponse.json({ message: 'store_id は必須です。' }, { status: 400 })
  }

  const storeCheck = await ensureStoreExists(storeId)
  if (!storeCheck.ok) {
    return NextResponse.json({ message: storeCheck.message }, { status: storeCheck.status })
  }

  const admin = createAdminSupabaseClient()
  const [{ data: tickets, error: ticketsError }, { data: events, error: eventsError }] = await Promise.all([
    admin
      .from('support_tickets')
      .select(
        'id, ticket_no, created_at, updated_at, subject, description, category, priority, status, source, assigned_user_id, resolved_at, closed_at, last_activity_at'
      )
      .eq('store_id', storeId)
      .order('last_activity_at', { ascending: false })
      .limit(300),
    admin
      .from('support_ticket_events')
      .select('id, ticket_id, actor_user_id, event_type, payload, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (ticketsError) {
    return NextResponse.json({ message: ticketsError.message }, { status: 500 })
  }
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
    storeId,
    tickets: rows,
  })
}

export async function PATCH(request: Request) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const payloadRaw: unknown = await request.json().catch(() => null)
  const payload = asJsonObjectOrNull(payloadRaw)

  const storeId = normalizeStoreId(payload?.store_id)
  const ticketId = typeof payload?.ticket_id === 'string' ? payload.ticket_id : ''
  if (!storeId || !ticketId) {
    return NextResponse.json({ message: 'store_id と ticket_id は必須です。' }, { status: 400 })
  }
  const storeCheck = await ensureStoreExists(storeId)
  if (!storeCheck.ok) {
    return NextResponse.json({ message: storeCheck.message }, { status: storeCheck.status })
  }

  const updates: SupportTicketUpdate = {
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  }
  const events: Array<{ event_type: string; payload: Json }> = []

  const status = payload?.status
  if (isTicketStatus(status)) {
    updates.status = status
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    if (status === 'closed') updates.closed_at = new Date().toISOString()
    if (status === 'open' || status === 'in_progress' || status === 'waiting_user') {
      updates.resolved_at = null
      updates.closed_at = null
    }
    events.push({
      event_type:
        status === 'resolved'
          ? 'resolved'
          : status === 'closed'
            ? 'closed'
            : status === 'open'
              ? 'reopened'
              : 'status_changed',
      payload: toJson({ status, actor_role: 'developer_admin', actor_scope: 'developer' }),
    })
  }

  const priority = payload?.priority
  if (isTicketPriority(priority)) {
    updates.priority = priority
    events.push({
      event_type: 'priority_changed',
      payload: toJson({ priority, actor_role: 'developer_admin', actor_scope: 'developer' }),
    })
  }

  const assignedUserId =
    typeof payload?.assigned_user_id === 'string' || payload?.assigned_user_id === null
      ? payload.assigned_user_id
      : undefined
  if (assignedUserId !== undefined) {
    updates.assigned_user_id = assignedUserId
    events.push({
      event_type: 'assigned',
      payload: toJson({
        assigned_user_id: assignedUserId,
        actor_role: 'developer_admin',
        actor_scope: 'developer',
      }),
    })
  }

  const comment = toSafeText(payload?.comment ?? payload?.note, 2000)
  if (comment) {
    events.push({
      event_type: 'note_added',
      payload: toJson({ note: comment, comment, actor_role: 'developer_admin', actor_scope: 'developer' }),
    })
  }

  if (events.length === 0) {
    return NextResponse.json({ message: '更新内容がありません。' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data: updated, error: updateError } = await admin
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .eq('store_id', storeId)
    .select(
      'id, ticket_no, created_at, updated_at, subject, description, category, priority, status, source, assigned_user_id, resolved_at, closed_at, last_activity_at'
    )
    .single()

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  const eventRows: SupportTicketEventInsert[] = events.map((event) => ({
      store_id: storeId,
      ticket_id: ticketId,
      actor_user_id: auth.user.id,
      event_type: event.event_type,
      payload: event.payload,
    }))

  const { error: eventError } = await admin.from('support_ticket_events').insert(eventRows)
  if (eventError) {
    return NextResponse.json({ message: eventError.message }, { status: 500 })
  }

  return NextResponse.json({ ticket: updated })
}
