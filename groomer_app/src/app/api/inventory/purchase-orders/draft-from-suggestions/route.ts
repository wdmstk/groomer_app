import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
  calculateExpectedOnIso,
  generatePurchaseOrderNo,
  normalizeSuggestedQuantity,
  normalizeSupplierName,
  type ReorderSuggestionRow,
} from '@/lib/inventory/reorder'
import { createStoreScopedClient } from '@/lib/supabase/store'

type DraftSuggestionLine = {
  itemId: string
  itemName: string
  supplierName: string
  quantity: number
  leadTimeDays: number
  unitCost: number
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const selectedItemIds = formData
    .getAll('selected_item_id')
    .map((value) => value.toString())
    .filter((value) => value.length > 0)

  if (selectedItemIds.length === 0) {
    return NextResponse.json({ message: '提案対象が選択されていません。' }, { status: 400 })
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: suggestionRows, error: suggestionError } = await supabase
    .from('inventory_reorder_suggestion_v')
    .select(
      'item_id, item_name, category, unit, supplier_name, current_stock, reorder_point, optimal_stock, minimum_order_quantity, order_lot_size, lead_time_days, last_inbound_unit_cost, recommended_quantity, priority_rank'
    )
    .eq('store_id', storeId)
    .in('item_id', selectedItemIds)

  if (suggestionError) {
    return NextResponse.json({ message: suggestionError.message }, { status: 500 })
  }

  const suggestions = (suggestionRows ?? []) as ReorderSuggestionRow[]
  if (suggestions.length === 0) {
    return NextResponse.json({ message: '選択された提案が見つかりません。' }, { status: 400 })
  }

  const lines: DraftSuggestionLine[] = []
  for (const row of suggestions) {
    const supplierOverride = formData.get(`supplier_name_${row.item_id}`)?.toString()
    const quantityOverride = formData.get(`recommended_quantity_${row.item_id}`)?.toString()
    const unitCostOverride = formData.get(`unit_cost_${row.item_id}`)?.toString()
    const quantity = normalizeSuggestedQuantity(
      quantityOverride,
      row.recommended_quantity,
      row.minimum_order_quantity,
      row.order_lot_size
    )
    if (quantity <= 0) continue
    lines.push({
      itemId: row.item_id,
      itemName: row.item_name,
      supplierName: normalizeSupplierName(supplierOverride || row.supplier_name),
      quantity,
      leadTimeDays: Math.max(0, Math.floor(Number(row.lead_time_days ?? 0))),
      unitCost: Math.max(0, Number(unitCostOverride || row.last_inbound_unit_cost || 0)),
    })
  }

  if (lines.length === 0) {
    return NextResponse.json({ message: '発注数量が0のため下書きを作成しませんでした。' }, { status: 400 })
  }

  const grouped = new Map<string, DraftSuggestionLine[]>()
  for (const line of lines) {
    const list = grouped.get(line.supplierName) ?? []
    list.push(line)
    grouped.set(line.supplierName, list)
  }

  for (const [supplierName, supplierLines] of grouped.entries()) {
    const maxLeadTimeDays = supplierLines.reduce(
      (max, line) => (line.leadTimeDays > max ? line.leadTimeDays : max),
      0
    )
    const orderPayload = {
      store_id: storeId,
      order_no: generatePurchaseOrderNo(),
      supplier_name: supplierName,
      status: 'draft',
      ordered_on: null,
      expected_on: calculateExpectedOnIso(maxLeadTimeDays),
      total_amount: 0,
      notes: '発注提案から自動生成',
    }

    const { data: createdOrder, error: orderError } = await supabase
      .from('inventory_purchase_orders')
      .insert(orderPayload)
      .select('id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes')
      .single()
    if (orderError) {
      return NextResponse.json({ message: orderError.message }, { status: 500 })
    }

    const linePayload = supplierLines.map((line) => ({
      store_id: storeId,
      purchase_order_id: createdOrder.id,
      item_id: line.itemId,
      item_name: line.itemName,
      quantity: line.quantity,
      unit_cost: line.unitCost,
      notes: '発注提案から自動生成',
    }))

    const { error: lineError } = await supabase.from('inventory_purchase_order_items').insert(linePayload)
    if (lineError) {
      return NextResponse.json({ message: lineError.message }, { status: 500 })
    }

    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'purchase_order',
      entityId: createdOrder.id,
      action: 'created_from_reorder_suggestion',
      after: createdOrder,
      payload: {
        supplier_name: supplierName,
        line_count: supplierLines.length,
        item_ids: supplierLines.map((line) => line.itemId),
      },
    })
  }

  return NextResponse.redirect(new URL('/inventory/purchase-orders', request.url))
}
