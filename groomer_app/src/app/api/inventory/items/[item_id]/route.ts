import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    item_id: string
  }>
}

function parseBoolean(value: string | null) {
  if (value === null) return true
  return value === 'true'
}

async function deleteItem(itemId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: before } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, supplier_name, jan_code, optimal_stock, is_active, notes')
    .eq('id', itemId)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('store_id', storeId)
  return { error, supabase, storeId, before }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { item_id } = await context.params

  if (method === 'delete') {
    const { error, supabase, storeId, before } = await deleteItem(item_id)
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (before) {
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'inventory_item',
        entityId: item_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.redirect(new URL('/inventory/products?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const name = formData.get('name')?.toString().trim()
    if (!name) {
      return NextResponse.json({ message: '商品名は必須です。' }, { status: 400 })
    }

    const payload = {
      name,
      category: formData.get('category')?.toString().trim() || null,
      unit: formData.get('unit')?.toString().trim() || '個',
      supplier_name: formData.get('supplier_name')?.toString().trim() || null,
      jan_code: formData.get('jan_code')?.toString().trim() || null,
      optimal_stock: Number(formData.get('optimal_stock')?.toString() || '0'),
      is_active: parseBoolean(formData.get('is_active')?.toString() ?? 'true'),
      notes: formData.get('notes')?.toString().trim() || null,
    }

    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('inventory_items')
      .select('id, name, category, unit, supplier_name, jan_code, optimal_stock, is_active, notes')
      .eq('id', item_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const { data: updatedItem, error } = await supabase
      .from('inventory_items')
      .update(payload)
      .eq('id', item_id)
      .eq('store_id', storeId)
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
      entityId: item_id,
      action: 'updated',
      before,
      after: updatedItem,
    })

    return NextResponse.redirect(new URL('/inventory/products?tab=list', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
