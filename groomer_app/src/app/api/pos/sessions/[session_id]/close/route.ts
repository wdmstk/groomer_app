import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { asObjectOrNull } from '@/lib/object-utils'
import { computePosSessionCloseSummary } from '@/lib/pos/session-close'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ session_id: string }>
}

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

export async function POST(request: Request, { params }: RouteParams) {
  const { session_id: sessionId } = await params
  const body = asObjectOrNull(await request.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ ok: false, code: 'POS_INVALID_JSON', message: 'invalid json body.' }, { status: 400 })
  }

  const cashCountedAmount = parseAmount(body.cash_counted_amount)
  const note = parseString(body.note)
  if (cashCountedAmount == null) {
    return NextResponse.json(
      { ok: false, code: 'POS_CASH_COUNT_REQUIRED', message: 'cash_counted_amount must be >= 0.' },
      { status: 400 }
    )
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: session, error: sessionError } = await supabase
    .from('pos_sessions')
    .select('id, status, notes, opened_at, closed_at')
    .eq('store_id', storeId)
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_FETCH_FAILED', message: sessionError.message }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_NOT_FOUND', message: 'session not found.' }, { status: 404 })
  }
  if (session.status === 'closed' && session.closed_at) {
    return NextResponse.json(
      {
        ok: false,
        code: 'POS_SESSION_ALREADY_CLOSED',
        message: 'session already closed.',
      },
      { status: 409 }
    )
  }
  if (session.status !== 'open') {
    return NextResponse.json(
      { ok: false, code: 'POS_SESSION_NOT_OPEN', message: 'session is not open.' },
      { status: 409 }
    )
  }

  const { data: confirmedOrders, error: orderError } = await supabase
    .from('pos_orders')
    .select('id, total_amount')
    .eq('store_id', storeId)
    .eq('session_id', sessionId)
    .eq('status', 'confirmed')

  if (orderError) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_ORDER_FETCH_FAILED', message: orderError.message }, { status: 500 })
  }

  const orderRows = (confirmedOrders ?? []) as Array<{ id: string; total_amount: number }>

  const orderIds = orderRows.map((row) => row.id)
  let orderPayments: Array<{ order_id: string; method: string }> = []
  if (orderIds.length > 0) {
    const { data: paymentRows, error: paymentError } = await supabase
      .from('pos_payments')
      .select('order_id, method')
      .eq('store_id', storeId)
      .eq('action_type', 'confirm')
      .in('order_id', orderIds)

    if (paymentError) {
      return NextResponse.json(
        { ok: false, code: 'POS_SESSION_PAYMENT_FETCH_FAILED', message: paymentError.message },
        { status: 500 }
      )
    }

    orderPayments = (paymentRows ?? []) as Array<{ order_id: string; method: string }>
  }

  const { data: drawerEvents, error: drawerError } = await supabase
    .from('cash_drawer_events')
    .select('event_type, amount')
    .eq('store_id', storeId)
    .eq('session_id', sessionId)

  if (drawerError) {
    return NextResponse.json({ ok: false, code: 'POS_SESSION_DRAWER_FETCH_FAILED', message: drawerError.message }, { status: 500 })
  }

  const summary = computePosSessionCloseSummary({
    confirmedOrders: orderRows,
    confirmPayments: orderPayments,
    drawerEvents: (drawerEvents ?? []) as Array<{ event_type: 'cash_in' | 'cash_out' | 'adjustment'; amount: number }>,
    cashCountedAmount,
  })
  const nowIso = new Date().toISOString()

  const nextNote = [session.notes, note].filter(Boolean).join('\n')
  const { data: closedSession, error: closeError } = await supabase
    .from('pos_sessions')
    .update({
      status: 'closed',
      closed_at: nowIso,
      closed_by_user_id: user?.id ?? null,
      updated_at: nowIso,
      notes: nextNote || null,
    })
    .eq('store_id', storeId)
    .eq('id', sessionId)
    .select('id, status, closed_at')
    .single()

  if (closeError || !closedSession) {
    return NextResponse.json(
      { ok: false, code: 'POS_SESSION_CLOSE_FAILED', message: closeError?.message ?? 'failed to close session.' },
      { status: 500 }
    )
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pos_session',
    entityId: sessionId,
    action: 'closed',
    before: session,
    after: closedSession,
    payload: summary,
  })

  return NextResponse.json({
    ok: true,
    data: {
      session_id: sessionId,
      status: 'closed',
      closed_at: closedSession.closed_at,
      summary,
    },
  })
}
