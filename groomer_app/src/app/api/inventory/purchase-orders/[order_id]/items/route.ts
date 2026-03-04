import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

type RouteParams = {
  params: Promise<{
    order_id: string
  }>
}

async function refreshOrderTotal(
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase'],
  storeId: string,
  orderId: string
) {
  const { data: lines, error: lineError } = await supabase
    .from('inventory_purchase_order_items')
    .select('quantity, unit_cost')
    .eq('store_id', storeId)
    .eq('purchase_order_id', orderId)

  if (lineError) {
    throw new Error(lineError.message)
  }

  const totalAmount = (lines ?? []).reduce(
    (sum, line) => sum + toNumber(line.quantity) * toNumber(line.unit_cost),
    0
  )

  const { error: updateError } = await supabase
    .from('inventory_purchase_orders')
    .update({ total_amount: totalAmount })
    .eq('id', orderId)
    .eq('store_id', storeId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const { order_id } = await context.params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const itemName = formData.get('item_name')?.toString().trim()
  const quantity = Number(formData.get('quantity')?.toString() || '0')
  const unitCost = Number(formData.get('unit_cost')?.toString() || '0')
  if (!itemName) {
    return NextResponse.json({ message: '明細名は必須です。' }, { status: 400 })
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ message: '数量は0より大きい値を指定してください。' }, { status: 400 })
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return NextResponse.json({ message: '単価は0以上を指定してください。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    purchase_order_id: order_id,
    item_id: formData.get('item_id')?.toString() || null,
    item_name: itemName,
    quantity,
    unit_cost: unitCost,
    notes: formData.get('notes')?.toString().trim() || null,
  }

  const { data: createdLine, error } = await supabase
    .from('inventory_purchase_order_items')
    .insert(payload)
    .select('id, purchase_order_id, item_id, item_name, quantity, unit_cost, notes')
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await refreshOrderTotal(supabase, storeId, order_id)
  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'purchase_order_item',
    entityId: createdLine.id,
    action: 'created',
    after: createdLine,
    payload: {
      purchase_order_id: order_id,
    },
  })
  return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
}
