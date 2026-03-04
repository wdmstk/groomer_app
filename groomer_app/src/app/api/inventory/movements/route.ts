import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

type MovementType = 'inbound' | 'outbound' | 'stocktake_adjustment'

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

function normalizeMovementType(value: string | null): MovementType {
  if (value === 'outbound') return 'outbound'
  if (value === 'stocktake_adjustment') return 'stocktake_adjustment'
  return 'inbound'
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id, item_id, movement_type, reason, quantity_delta, unit_cost, lot_number, expires_on, happened_at, notes')
    .eq('store_id', storeId)
    .order('happened_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const itemId = formData.get('item_id')?.toString().trim()
  const movementType = normalizeMovementType(formData.get('movement_type')?.toString() ?? null)
  const quantity = Number(formData.get('quantity')?.toString() || '0')
  if (!itemId) {
    return NextResponse.json({ message: '商品は必須です。' }, { status: 400 })
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ message: '数量は0より大きい値を指定してください。' }, { status: 400 })
  }

  const quantityDelta = movementType === 'outbound' ? -quantity : quantity
  if (movementType === 'outbound') {
    const currentStock = await getCurrentStock(supabase, itemId, storeId)
    if (currentStock < quantity) {
      return NextResponse.json(
        { message: `在庫不足です。現在庫: ${currentStock} / 出庫要求: ${quantity}` },
        { status: 400 }
      )
    }
  }

  const payload = {
    store_id: storeId,
    item_id: itemId,
    movement_type: movementType,
    reason: formData.get('reason')?.toString().trim() || null,
    quantity_delta: quantityDelta,
    unit_cost: formData.get('unit_cost') ? Number(formData.get('unit_cost')) : null,
    lot_number: formData.get('lot_number')?.toString().trim() || null,
    expires_on: formData.get('expires_on')?.toString() || null,
    happened_at: formData.get('happened_at')?.toString() || new Date().toISOString(),
    notes: formData.get('notes')?.toString().trim() || null,
    created_by: user?.id ?? null,
  }

  const { data: createdMovement, error } = await supabase
    .from('inventory_movements')
    .insert(payload)
    .select('id, item_id, movement_type, reason, quantity_delta, unit_cost, lot_number, expires_on, happened_at, notes, created_by')
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
      requested_quantity: quantity,
      movement_type: movementType,
    },
  })

  const redirectPath = movementType === 'outbound' ? '/inventory/outbounds' : '/inventory/inbounds'
  return NextResponse.redirect(new URL(redirectPath, request.url))
}
