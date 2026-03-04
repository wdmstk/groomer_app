import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

async function getCurrentStock(
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase'],
  itemId: string,
  storeId: string
) {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('quantity_delta')
    .eq('store_id', storeId)
    .eq('item_id', itemId)
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).reduce((sum, row) => sum + toNumber(row.quantity_delta), 0)
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const itemId = formData.get('item_id')?.toString().trim()
  const actualQuantity = Number(formData.get('actual_quantity')?.toString() || '0')
  if (!itemId) {
    return NextResponse.json({ message: '商品は必須です。' }, { status: 400 })
  }
  if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
    return NextResponse.json({ message: '実在庫は0以上を指定してください。' }, { status: 400 })
  }

  const currentStock = await getCurrentStock(supabase, itemId, storeId)
  const delta = actualQuantity - currentStock
  if (Math.abs(delta) < 0.000001) {
    return NextResponse.redirect(new URL('/inventory/stocktake', request.url))
  }

  const payload = {
    store_id: storeId,
    item_id: itemId,
    movement_type: 'stocktake_adjustment',
    reason: formData.get('reason')?.toString().trim() || '棚卸調整',
    quantity_delta: delta,
    happened_at: formData.get('happened_at')?.toString() || new Date().toISOString(),
    notes: formData.get('notes')?.toString().trim() || null,
    created_by: user?.id ?? null,
  }

  const { data: createdMovement, error } = await supabase
    .from('inventory_movements')
    .insert(payload)
    .select('id, item_id, movement_type, reason, quantity_delta, happened_at, notes, created_by')
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'inventory_movement',
    entityId: createdMovement.id,
    action: 'created',
    after: createdMovement,
    payload: {
      source: 'stocktake',
      current_stock: currentStock,
      actual_quantity: actualQuantity,
      quantity_delta: delta,
    },
  })

  return NextResponse.redirect(new URL('/inventory/stocktake', request.url))
}
