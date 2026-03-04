import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    order_id: string
  }>
}

async function deleteOrder(orderId: string) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: before } = await supabase
    .from('inventory_purchase_orders')
    .select('id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle()
  const { error } = await supabase
    .from('inventory_purchase_orders')
    .delete()
    .eq('id', orderId)
    .eq('store_id', storeId)
  return { error, supabase, storeId, before }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { order_id } = await context.params

  if (method === 'delete') {
    const { error, supabase, storeId, before } = await deleteOrder(order_id)
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
        entityType: 'purchase_order',
        entityId: order_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const payload = {
      supplier_name: formData.get('supplier_name')?.toString().trim() || null,
      status: formData.get('status')?.toString() || 'draft',
      ordered_on: formData.get('ordered_on')?.toString() || null,
      expected_on: formData.get('expected_on')?.toString() || null,
      total_amount: Number(formData.get('total_amount')?.toString() || '0'),
      notes: formData.get('notes')?.toString().trim() || null,
    }

    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('inventory_purchase_orders')
      .select('id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes')
      .eq('id', order_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const { data: updatedOrder, error } = await supabase
      .from('inventory_purchase_orders')
      .update(payload)
      .eq('id', order_id)
      .eq('store_id', storeId)
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
      entityId: order_id,
      action: 'updated',
      before,
      after: updatedOrder,
    })

    return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
