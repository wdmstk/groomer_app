import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

type RouteParams = {
  params: Promise<{
    line_id: string
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
  const method = formData.get('_method')?.toString().toLowerCase()
  const { line_id } = await context.params
  if (method !== 'delete') {
    return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: line, error: findError } = await supabase
    .from('inventory_purchase_order_items')
    .select('id, purchase_order_id, item_id, item_name, quantity, unit_cost, notes')
    .eq('id', line_id)
    .eq('store_id', storeId)
    .single()

  if (findError) {
    return NextResponse.json({ message: findError.message }, { status: 500 })
  }

  const orderId = line.purchase_order_id
  const { error } = await supabase
    .from('inventory_purchase_order_items')
    .delete()
    .eq('id', line_id)
    .eq('store_id', storeId)
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await refreshOrderTotal(supabase, storeId, orderId)
  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'purchase_order_item',
    entityId: line_id,
    action: 'deleted',
    before: line,
    payload: {
      purchase_order_id: orderId,
    },
  })
  return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
}
