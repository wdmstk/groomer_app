import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

function parseBoolean(value: string | null) {
  if (value === null) return true
  return value === 'true'
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, supplier_name, jan_code, optimal_stock, is_active, notes')
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

  const payload = {
    store_id: storeId,
    name,
    category: formData.get('category')?.toString().trim() || null,
    unit: formData.get('unit')?.toString().trim() || '個',
    supplier_name: formData.get('supplier_name')?.toString().trim() || null,
    jan_code: formData.get('jan_code')?.toString().trim() || null,
    optimal_stock: Number(formData.get('optimal_stock')?.toString() || '0'),
    is_active: parseBoolean(formData.get('is_active')?.toString() ?? 'true'),
    notes: formData.get('notes')?.toString().trim() || null,
  }

  const { data: createdItem, error } = await supabase
    .from('inventory_items')
    .insert(payload)
    .select('id, name, category, unit, supplier_name, jan_code, optimal_stock, is_active, notes')
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

  return NextResponse.redirect(new URL('/inventory/products?tab=list', request.url))
}
