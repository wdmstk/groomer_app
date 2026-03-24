import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { asObjectOrNull } from '@/lib/object-utils'
import { createStoreScopedClient } from '@/lib/supabase/store'

type EventType = 'cash_in' | 'cash_out' | 'adjustment'

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function parseAmount(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount)
}

function parseEventType(value: unknown): EventType | null {
  if (value === 'cash_in' || value === 'cash_out' || value === 'adjustment') return value
  return null
}

export async function POST(request: Request) {
  const body = asObjectOrNull(await request.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ ok: false, code: 'POS_INVALID_JSON', message: 'invalid json body.' }, { status: 400 })
  }

  const sessionId = parseString(body.session_id)
  const eventType = parseEventType(body.event_type)
  const amount = parseAmount(body.amount)
  const reason = parseString(body.reason)
  const notes = parseString(body.notes)
  const happenedAt = parseString(body.happened_at) ?? new Date().toISOString()

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, code: 'POS_SESSION_ID_REQUIRED', message: 'session_id is required.' },
      { status: 400 }
    )
  }
  if (!eventType) {
    return NextResponse.json(
      { ok: false, code: 'POS_EVENT_TYPE_REQUIRED', message: 'event_type is required.' },
      { status: 400 }
    )
  }
  if (amount == null) {
    return NextResponse.json({ ok: false, code: 'POS_AMOUNT_INVALID', message: 'amount must be >= 0.' }, { status: 400 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: session, error: sessionError } = await supabase
    .from('pos_sessions')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_FETCH_FAILED', message: sessionError.message }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_NOT_FOUND', message: 'session not found.' }, { status: 404 })
  }
  if (session.status !== 'open') {
    return NextResponse.json(
      { ok: false, code: 'POS_SESSION_NOT_OPEN', message: 'cash drawer event is allowed only in open session.' },
      { status: 409 }
    )
  }

  const { data: event, error: insertError } = await supabase
    .from('cash_drawer_events')
    .insert({
      store_id: storeId,
      session_id: sessionId,
      event_type: eventType,
      amount,
      reason,
      happened_at: happenedAt,
      notes,
      created_by_user_id: user?.id ?? null,
    })
    .select('id, session_id, event_type, amount, reason, happened_at, notes')
    .single()

  if (insertError || !event) {
    return NextResponse.json(
      { ok: false, code: 'POS_CASH_EVENT_CREATE_FAILED', message: insertError?.message ?? 'failed to insert event.' },
      { status: 500 }
    )
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'cash_drawer_event',
    entityId: event.id,
    action: 'created',
    after: event,
  })

  return NextResponse.json(
    {
      ok: true,
      data: {
        event,
      },
    },
    { status: 201 }
  )
}
