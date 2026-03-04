import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { aggregateStockByItem, toNumber } from '@/lib/inventory/stock'

function csvEscape(value: string | number) {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: items, error: itemError } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, supplier_name, optimal_stock, is_active')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (itemError) {
    return NextResponse.json({ message: itemError.message }, { status: 500 })
  }

  const itemIds = (items ?? []).map((item) => item.id)
  const { data: movements, error: movementError } =
    itemIds.length > 0
      ? await supabase
          .from('inventory_movements')
          .select('item_id, quantity_delta')
          .eq('store_id', storeId)
          .in('item_id', itemIds)
      : { data: [], error: null }

  if (movementError) {
    return NextResponse.json({ message: movementError.message }, { status: 500 })
  }

  const stockMap = aggregateStockByItem(movements ?? [])
  const header = ['商品名', 'カテゴリ', '単位', '仕入先', '現在庫', '適正在庫', '状態']
  const lines = [header.join(',')]

  for (const item of items ?? []) {
    const currentStock = stockMap.get(item.id) ?? 0
    const optimalStock = toNumber(item.optimal_stock)
    const status = currentStock < optimalStock ? '不足' : '正常'
    lines.push(
      [
        item.name,
        item.category ?? '',
        item.unit,
        item.supplier_name ?? '',
        currentStock,
        optimalStock,
        status,
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  const csv = `\uFEFF${lines.join('\n')}`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="inventory-stocks.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
