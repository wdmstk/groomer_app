import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { asObjectOrNull } from '@/lib/object-utils'
import type { UnknownObject } from '@/lib/object-utils'
import { calculatePosCartTotals } from '@/lib/pos/checkout'
import { createStoreScopedClient } from '@/lib/supabase/store'

type OrderLineInput = {
  line_type: 'service' | 'product' | 'manual_adjustment'
  source_id?: string | null
  label: string
  quantity: number
  unit_amount: number
  tax_rate?: number
  tax_included?: boolean
  metadata?: UnknownObject
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const payload = asObjectOrNull(body)
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'POS_INVALID_JSON', message: 'invalid json body.' }, { status: 400 })
  }

  const linesRaw = Array.isArray(payload.lines) ? (payload.lines as OrderLineInput[]) : []
  if (linesRaw.length === 0) {
    return NextResponse.json({ ok: false, code: 'POS_LINES_REQUIRED', message: 'lines are required.' }, { status: 400 })
  }

  const customerId = typeof payload.customer_id === 'string' ? payload.customer_id : null
  const appointmentId = typeof payload.appointment_id === 'string' ? payload.appointment_id : null
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null
  const discountAmount = Number(payload.discount_amount ?? 0)

  const normalizedLines = linesRaw.map((line, index) => {
    const quantity = Math.max(0, Number(line.quantity ?? 0))
    const unitAmount = Math.max(0, Number(line.unit_amount ?? 0))
    const taxRate = Number.isFinite(Number(line.tax_rate)) ? Number(line.tax_rate) : 0.1
    const taxIncluded = typeof line.tax_included === 'boolean' ? line.tax_included : true
    const lineTotals = calculatePosCartTotals(
      [{ quantity, unitAmount, taxRate, taxIncluded }],
      0
    )
    return {
      line_type: line.line_type ?? 'product',
      source_id: line.source_id ?? null,
      label: String(line.label ?? ''),
      quantity,
      unit_amount: unitAmount,
      tax_rate: taxRate,
      tax_included: taxIncluded,
      line_subtotal: lineTotals.subtotal,
      line_tax: lineTotals.tax,
      line_total: lineTotals.total,
      sort_order: index + 1,
      metadata: line.metadata ?? {},
    }
  })

  const totals = calculatePosCartTotals(
    normalizedLines.map((line) => ({
      quantity: line.quantity,
      unitAmount: line.unit_amount,
      taxRate: line.tax_rate,
      taxIncluded: line.tax_included,
    })),
    discountAmount
  )

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: order, error: orderError } = await supabase
    .from('pos_orders')
    .insert({
      store_id: storeId,
      session_id: sessionId,
      customer_id: customerId,
      appointment_id: appointmentId,
      status: 'draft',
      subtotal_amount: totals.subtotal,
      tax_amount: totals.tax,
      discount_amount: totals.discount,
      total_amount: totals.total,
      created_by_user_id: user?.id ?? null,
      updated_by_user_id: user?.id ?? null,
    })
    .select('id, status, subtotal_amount, tax_amount, discount_amount, total_amount')
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { ok: false, code: 'POS_ORDER_CREATE_FAILED', message: orderError?.message ?? 'failed to create order.' },
      { status: 500 }
    )
  }

  const linesPayload = normalizedLines.map((line) => ({
    ...line,
    store_id: storeId,
    order_id: order.id,
  }))

  const { error: linesError } = await supabase.from('pos_order_lines').insert(linesPayload)
  if (linesError) {
    await supabase.from('pos_orders').delete().eq('store_id', storeId).eq('id', order.id)
    return NextResponse.json({ ok: false, code: 'POS_LINES_CREATE_FAILED', message: linesError.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'pos_order',
    entityId: order.id,
    action: 'created',
    after: order,
    payload: {
      lines_count: normalizedLines.length,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      data: {
        order,
      },
    },
    { status: 201 }
  )
}
