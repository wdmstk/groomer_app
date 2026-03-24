import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { toNumber } from '@/lib/inventory/stock'
import { asObjectOrNull } from '@/lib/object-utils'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ order_id: string }>
}

function parseString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(request: Request, { params }: RouteParams) {
  const { order_id: orderId } = await params
  const body = asObjectOrNull(await request.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ ok: false, code: 'POS_INVALID_JSON', message: 'invalid json body.' }, { status: 400 })
  }

  const reason = parseString(body.reason)
  const idempotencyKey = parseString(body.idempotency_key)
  if (!reason) {
    return NextResponse.json({ ok: false, code: 'POS_VOID_REASON_REQUIRED', message: 'reason is required.' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json(
      { ok: false, code: 'POS_IDEMPOTENCY_REQUIRED', message: 'idempotency_key is required.' },
      { status: 400 }
    )
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existingVoidPayment, error: existingVoidPaymentError } = await supabase
    .from('pos_payments')
    .select('id')
    .eq('store_id', storeId)
    .eq('action_type', 'void')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingVoidPaymentError) {
    return NextResponse.json(
      { ok: false, code: 'POS_VOID_DUPLICATED', message: existingVoidPaymentError.message },
      { status: 500 }
    )
  }

  const { data: order, error: orderError } = await supabase
    .from('pos_orders')
    .select('id, status, payment_id, total_amount')
    .eq('store_id', storeId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ ok: false, code: 'POS_ORDER_NOT_FOUND', message: orderError.message }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ ok: false, code: 'POS_ORDER_NOT_FOUND', message: 'order not found.' }, { status: 404 })
  }

  const { data: existingRefund, error: existingRefundError } = await supabase
    .from('pos_refunds')
    .select('id')
    .eq('store_id', storeId)
    .eq('order_id', orderId)
    .eq('refund_type', 'void')
    .maybeSingle()

  if (existingRefundError) {
    return NextResponse.json({ ok: false, code: 'POS_VOID_ALREADY_FAILED', message: existingRefundError.message }, { status: 500 })
  }

  if (order.status === 'void' && existingRefund?.id) {
    return NextResponse.json({
      ok: true,
      data: {
        order_id: orderId,
        status: 'void',
        refund_id: existingRefund.id,
        reused: true,
      },
    })
  }

  if (order.status !== 'confirmed') {
    return NextResponse.json(
      { ok: false, code: 'POS_ORDER_NOT_VOIDABLE', message: 'only confirmed order can be voided.' },
      { status: 409 }
    )
  }

  const { data: lines, error: linesError } = await supabase
    .from('pos_order_lines')
    .select('line_type, source_id, quantity')
    .eq('store_id', storeId)
    .eq('order_id', orderId)

  if (linesError) {
    return NextResponse.json({ ok: false, code: 'POS_LINES_FETCH_FAILED', message: linesError.message }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  const productLines = ((lines ?? []) as Array<{ line_type: string; source_id: string | null; quantity: number }>).filter(
    (line) => line.line_type === 'product' && line.source_id
  )
  if (productLines.length > 0) {
    const inventoryPayload = productLines.map((line) => ({
      store_id: storeId,
      item_id: line.source_id,
      movement_type: 'inbound',
      reason: 'POS取消戻し',
      quantity_delta: Math.abs(toNumber(line.quantity)),
      happened_at: nowIso,
      notes: `POS void: ${orderId}`,
      created_by: user?.id ?? null,
    }))
    const { error: inventoryError } = await supabase.from('inventory_movements').insert(inventoryPayload)
    if (inventoryError) {
      return NextResponse.json(
        { ok: false, code: 'POS_INVENTORY_REVERT_FAILED', message: inventoryError.message },
        { status: 500 }
      )
    }
  }

  const { data: refund, error: refundError } = await supabase
    .from('pos_refunds')
    .insert({
      store_id: storeId,
      order_id: orderId,
      refund_type: 'void',
      amount: Math.round(toNumber(order.total_amount)),
      reason,
      refunded_at: nowIso,
      refunded_by_user_id: user?.id ?? null,
    })
    .select('id')
    .single()

  if (refundError || !refund) {
    return NextResponse.json(
      { ok: false, code: 'POS_VOID_CREATE_FAILED', message: refundError?.message ?? 'failed to create void record.' },
      { status: 500 }
    )
  }

  if (order.payment_id) {
    const { error: posPaymentError } = await supabase.from('pos_payments').insert({
      store_id: storeId,
      order_id: orderId,
      payment_id: order.payment_id,
      method: '取消',
      action_type: 'void',
      idempotency_key: idempotencyKey,
      notes: reason,
      paid_at: nowIso,
      created_by_user_id: user?.id ?? null,
    })
    if (posPaymentError && !existingVoidPayment?.id) {
      return NextResponse.json(
        { ok: false, code: 'POS_VOID_PAYMENT_LINK_FAILED', message: posPaymentError.message },
        { status: 500 }
      )
    }

    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: '取消',
        notes: reason,
      })
      .eq('store_id', storeId)
      .eq('id', order.payment_id)
    if (paymentUpdateError) {
      return NextResponse.json(
        { ok: false, code: 'POS_VOID_PAYMENT_UPDATE_FAILED', message: paymentUpdateError.message },
        { status: 500 }
      )
    }
  }

  const { data: updatedOrder, error: updateOrderError } = await supabase
    .from('pos_orders')
    .update({
      status: 'void',
      voided_at: nowIso,
      void_reason: reason,
      updated_by_user_id: user?.id ?? null,
      updated_at: nowIso,
    })
    .eq('store_id', storeId)
    .eq('id', orderId)
    .select('id, status')
    .single()

  if (updateOrderError || !updatedOrder) {
    return NextResponse.json(
      { ok: false, code: 'POS_ORDER_UPDATE_FAILED', message: updateOrderError?.message ?? 'failed to update order.' },
      { status: 500 }
    )
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pos_order',
    entityId: orderId,
    action: 'voided',
    after: updatedOrder,
    payload: {
      refund_id: refund.id,
      idempotency_key: idempotencyKey,
      reverted_product_line_count: productLines.length,
    },
  })

  return NextResponse.json({
    ok: true,
    data: {
      order_id: orderId,
      status: 'void',
      refund_id: refund.id,
      reused: false,
    },
  })
}
