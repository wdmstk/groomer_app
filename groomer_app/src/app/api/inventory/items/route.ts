import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

function parseBoolean(value: string | null) {
  if (value === null) return true
  return value === 'true'
}

function normalizeSupplierNames(formData: FormData) {
  const legacySupplierName = formData.get('supplier_name')?.toString().trim() || null
  const preferredSupplierName = formData.get('preferred_supplier_name')?.toString().trim() || null
  const normalized = preferredSupplierName ?? legacySupplierName
  return {
    supplier_name: normalized,
    preferred_supplier_name: normalized,
  }
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

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

  const name = formData.get('name')?.toString().trim()
  if (!name) {
    return NextResponse.json({ message: '商品名は必須です。' }, { status: 400 })
  }

  const supplierNames = normalizeSupplierNames(formData)
  const payload = {
    store_id: storeId,
    name,
    category: formData.get('category')?.toString().trim() || null,
    unit: formData.get('unit')?.toString().trim() || '個',
    supplier_name: supplierNames.supplier_name,
    jan_code: formData.get('jan_code')?.toString().trim() || null,
    optimal_stock: Number(formData.get('optimal_stock')?.toString() || '0'),
    reorder_point: Number(formData.get('reorder_point')?.toString() || '0'),
    lead_time_days: Number(formData.get('lead_time_days')?.toString() || '0'),
    preferred_supplier_name: supplierNames.preferred_supplier_name,
    minimum_order_quantity: Number(formData.get('minimum_order_quantity')?.toString() || '0'),
    order_lot_size: Number(formData.get('order_lot_size')?.toString() || '0'),
    is_active: parseBoolean(formData.get('is_active')?.toString() ?? 'true'),
    notes: formData.get('notes')?.toString().trim() || null,
  }

  const { data: createdItem, error } = await supabase
    .from('inventory_items')
    .insert(payload)
    .select(
      'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
    )
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'inventory_item',
    entityId: createdItem.id,
    action: 'created',
    after: createdItem,
  })

  return NextResponse.redirect(new URL('/inventory/products', request.url))
}
