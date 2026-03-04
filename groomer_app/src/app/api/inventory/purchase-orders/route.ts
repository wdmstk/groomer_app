import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

function generateOrderNo() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const suffix = `${Math.floor(Math.random() * 9000) + 1000}`
  return `PO-${y}${m}${d}-${suffix}`
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('inventory_purchase_orders')
    .select('id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes')
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

  const supplierName = formData.get('supplier_name')?.toString().trim()
  if (!supplierName) {
    return NextResponse.json({ message: '仕入先は必須です。' }, { status: 400 })
  }

  const payload = {
    store_id: storeId,
    order_no: formData.get('order_no')?.toString().trim() || generateOrderNo(),
    supplier_name: supplierName,
    status: formData.get('status')?.toString() || 'draft',
    ordered_on: formData.get('ordered_on')?.toString() || null,
    expected_on: formData.get('expected_on')?.toString() || null,
    total_amount: Number(formData.get('total_amount')?.toString() || '0'),
    notes: formData.get('notes')?.toString().trim() || null,
  }

  const { data: createdOrder, error } = await supabase
    .from('inventory_purchase_orders')
    .insert(payload)
    .select('id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes')
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'purchase_order',
    entityId: createdOrder.id,
    action: 'created',
    after: createdOrder,
  })

  return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
}
