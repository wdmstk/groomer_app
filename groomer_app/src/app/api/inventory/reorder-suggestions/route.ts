import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function GET(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const { searchParams } = new URL(request.url)
  const supplierName = searchParams.get('supplier_name')?.trim()
  const onlyBelowReorderPoint = searchParams.get('only_below_reorder_point')
  const { data, error } =
    onlyBelowReorderPoint === 'false'
      ? await (() => {
          let query = supabase
            .from('inventory_stock_summary_v')
            .select(
              'item_id, item_name, category, unit, supplier_name, current_stock, reorder_point, optimal_stock, minimum_order_quantity, order_lot_size, lead_time_days, last_inbound_unit_cost, last_inbound_at, last_outbound_at, expiring_14d_lot_count'
            )
            .eq('store_id', storeId)
            .order('item_name', { ascending: true })
          if (supplierName) {
            query = query.eq('supplier_name', supplierName)
          }
          return query
        })()
      : await (() => {
          let query = supabase
            .from('inventory_reorder_suggestion_v')
            .select(
              'item_id, item_name, category, unit, supplier_name, current_stock, reorder_point, optimal_stock, minimum_order_quantity, order_lot_size, lead_time_days, last_inbound_unit_cost, last_inbound_at, last_outbound_at, expiring_14d_lot_count, is_below_reorder_point, raw_recommended_quantity, recommended_quantity, priority_rank'
            )
            .eq('store_id', storeId)
            .order('priority_rank', { ascending: true })
          if (supplierName) {
            query = query.eq('supplier_name', supplierName)
          }
          return query
        })()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
