import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'
import { asObjectOrNull } from '@/lib/object-utils'

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

  const method = parseString(body.method)
  const idempotencyKey = parseString(body.idempotency_key)
  const notes = parseString(body.notes)
  if (!method) {
    return NextResponse.json(
      { ok: false, code: 'POS_PAYMENT_METHOD_REQUIRED', message: 'payment method is required.' },
      { status: 400 }
    )
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

  const { data: existingPosPayment, error: existingPosPaymentError } = await supabase
    .from('pos_payments')
    .select('id, payment_id')
    .eq('store_id', storeId)
    .eq('action_type', 'confirm')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingPosPaymentError) {
    return NextResponse.json(
      { ok: false, code: 'POS_CONFIRM_DUPLICATED', message: existingPosPaymentError.message },
      { status: 500 }
    )
  }

  if (existingPosPayment?.payment_id) {
    return NextResponse.json({
      ok: true,
      data: {
        order_id: orderId,
        status: 'confirmed',
        payment_id: existingPosPayment.payment_id,
        receipt_path: `/receipts/${existingPosPayment.payment_id}`,
        reused: true,
      },
    })
  }

  const { data: order, error: orderError } = await supabase
    .from('pos_orders')
    .select('id, status, appointment_id, customer_id, subtotal_amount, tax_amount, discount_amount, total_amount, payment_id')
    .eq('store_id', storeId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ ok: false, code: 'POS_ORDER_NOT_FOUND', message: orderError.message }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ ok: false, code: 'POS_ORDER_NOT_FOUND', message: 'order not found.' }, { status: 404 })
  }
  if (order.status !== 'draft' && order.status !== 'confirmed') {
    return NextResponse.json({ ok: false, code: 'POS_ORDER_NOT_EDITABLE', message: 'order is not editable.' }, { status: 409 })
  }
  if (!order.appointment_id) {
    return NextResponse.json(
      { ok: false, code: 'POS_APPOINTMENT_REQUIRED', message: 'appointment_id is required for payment compatibility.' },
      { status: 409 }
    )
  }
  if (!order.customer_id) {
    return NextResponse.json(
      { ok: false, code: 'POS_CUSTOMER_REQUIRED', message: 'customer_id is required for payment compatibility.' },
      { status: 409 }
    )
  }

  if (order.status === 'confirmed' && order.payment_id) {
    return NextResponse.json({
      ok: true,
      data: {
        order_id: orderId,
        status: 'confirmed',
        payment_id: order.payment_id,
        receipt_path: `/receipts/${order.payment_id}`,
        reused: true,
      },
    })
  }

  const { data: lines, error: linesError } = await supabase
    .from('pos_order_lines')
    .select('id, line_type, source_id, quantity, unit_amount, metadata')
    .eq('store_id', storeId)
    .eq('order_id', orderId)

  if (linesError) {
    return NextResponse.json({ ok: false, code: 'POS_LINES_FETCH_FAILED', message: linesError.message }, { status: 500 })
  }

  const productLines = ((lines ?? []) as Array<{
    id: string
    line_type: string
    source_id: string | null
    quantity: number
    unit_amount: number
  }>).filter((line) => line.line_type === 'product')

  const productIds = Array.from(new Set(productLines.map((line) => line.source_id).filter(Boolean)))
  if (productIds.length > 0) {
    const { data: currentStocks, error: stockError } = await supabase
      .from('inventory_movements')
      .select('item_id, quantity_delta')
      .eq('store_id', storeId)
      .in('item_id', productIds)

    if (stockError) {
      return NextResponse.json({ ok: false, code: 'POS_STOCK_FETCH_FAILED', message: stockError.message }, { status: 500 })
    }

    const stockByItem = new Map<string, number>()
    ;((currentStocks ?? []) as Array<{ item_id: string; quantity_delta: number }>).forEach((row) => {
      const current = stockByItem.get(row.item_id) ?? 0
      stockByItem.set(row.item_id, current + toNumber(row.quantity_delta))
    })

    for (const line of productLines) {
      if (!line.source_id) {
        return NextResponse.json(
          { ok: false, code: 'POS_PRODUCT_SOURCE_REQUIRED', message: 'product line requires source_id.' },
          { status: 422 }
        )
      }
      const currentStock = stockByItem.get(line.source_id) ?? 0
      if (currentStock < toNumber(line.quantity)) {
        return NextResponse.json(
          {
            ok: false,
            code: 'POS_OUT_OF_STOCK',
            message: `在庫不足です。item_id=${line.source_id} 現在庫=${currentStock} 必要数=${toNumber(line.quantity)}`,
          },
          { status: 422 }
        )
      }
    }
  }

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from('payments')
    .select('id, idempotency_key')
    .eq('store_id', storeId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingPaymentError) {
    return NextResponse.json(
      { ok: false, code: 'POS_CONFIRM_DUPLICATED', message: existingPaymentError.message },
      { status: 500 }
    )
  }

  let paymentId: string | null = existingPayment?.id ?? null
  if (!paymentId) {
    const nowIso = new Date().toISOString()
    const { data: insertedPayment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        store_id: storeId,
        appointment_id: order.appointment_id,
        customer_id: order.customer_id,
        status: '支払済',
        method,
        subtotal_amount: Math.round(toNumber(order.subtotal_amount)),
        tax_amount: Math.round(toNumber(order.tax_amount)),
        discount_amount: Math.round(toNumber(order.discount_amount)),
        total_amount: Math.round(toNumber(order.total_amount)),
        paid_at: nowIso,
        notes,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()

    if (paymentError || !insertedPayment) {
      return NextResponse.json(
        { ok: false, code: 'POS_PAYMENT_CREATE_FAILED', message: paymentError?.message ?? 'failed to create payment.' },
        { status: 500 }
      )
    }
    paymentId = insertedPayment.id
  }

  if (productLines.length > 0) {
    const nowIso = new Date().toISOString()
    const inventoryPayload = productLines
      .filter((line) => line.source_id)
      .map((line) => ({
        store_id: storeId,
        item_id: line.source_id,
        movement_type: 'outbound',
        reason: '店販売上',
        quantity_delta: -Math.abs(toNumber(line.quantity)),
        happened_at: nowIso,
        notes: `POS order: ${orderId}`,
        created_by: user?.id ?? null,
      }))

    if (inventoryPayload.length > 0) {
      const { error: movementError } = await supabase.from('inventory_movements').insert(inventoryPayload)
      if (movementError) {
        return NextResponse.json(
          { ok: false, code: 'POS_INVENTORY_APPLY_FAILED', message: movementError.message },
          { status: 500 }
        )
      }
    }
  }

  const nowIso = new Date().toISOString()
  const { error: posPaymentError } = await supabase.from('pos_payments').insert({
    store_id: storeId,
    order_id: orderId,
    payment_id: paymentId,
    method,
    action_type: 'confirm',
    idempotency_key: idempotencyKey,
    notes,
    paid_at: nowIso,
    created_by_user_id: user?.id ?? null,
  })

  if (posPaymentError) {
    return NextResponse.json(
      { ok: false, code: 'POS_PAYMENT_LINK_FAILED', message: posPaymentError.message },
      { status: 500 }
    )
  }

  const { data: updatedOrder, error: updateOrderError } = await supabase
    .from('pos_orders')
    .update({
      status: 'confirmed',
      payment_id: paymentId,
      confirmed_at: nowIso,
      paid_at: nowIso,
      updated_by_user_id: user?.id ?? null,
      updated_at: nowIso,
    })
    .eq('store_id', storeId)
    .eq('id', orderId)
    .select('id, status, payment_id')
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
    action: 'confirmed',
    after: updatedOrder,
    payload: {
      payment_id: paymentId,
      idempotency_key: idempotencyKey,
      product_line_count: productLines.length,
    },
  })

  return NextResponse.json({
    ok: true,
    data: {
      order_id: orderId,
      status: 'confirmed',
      payment_id: paymentId,
      receipt_path: `/receipts/${paymentId}`,
      reused: false,
    },
  })
}
