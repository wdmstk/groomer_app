import { Card } from '@/components/ui/Card'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { aggregateStockByItem, toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type Item = {
  id: string
  category: string | null
}

type MovementRow = {
  item_id: string
  movement_type: 'inbound' | 'outbound' | 'stocktake_adjustment'
  quantity_delta: number
  unit_cost: number | null
  happened_at: string
}

export default async function InventoryReportsPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()
  const now = isPlaywrightE2E ? new Date(inventoryPageFixtures.dashboardNowIso) : new Date()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const items = isPlaywrightE2E
    ? inventoryPageFixtures.productItems.filter((item) => item.is_active).map((item) => ({
        id: item.id,
        category: item.category,
      }))
    : (
        await supabase!
          .from('inventory_items')
          .select('id, category')
          .eq('store_id', storeId)
          .eq('is_active', true)
      ).data

  const allMovements = isPlaywrightE2E
    ? inventoryPageFixtures.dashboardMovements.map((row) => ({
        item_id: row.item_id,
        movement_type: row.movement_type,
        quantity_delta: row.quantity_delta,
        unit_cost:
          row.item_id === 'item-001' ? 850 : row.item_id === 'item-002' ? 320 : row.item_id === 'item-003' ? 90 : 1200,
        happened_at: row.happened_at,
      }))
    : (
        await supabase!
          .from('inventory_movements')
          .select('item_id, movement_type, quantity_delta, unit_cost, happened_at')
          .eq('store_id', storeId)
      ).data

  const monthMovements = isPlaywrightE2E
    ? inventoryPageFixtures.dashboardMovements
        .filter((row) => row.happened_at >= monthAgo)
        .map((row) => ({
          item_id: row.item_id,
          movement_type: row.movement_type,
          quantity_delta: row.quantity_delta,
          unit_cost:
            row.item_id === 'item-001' ? 850 : row.item_id === 'item-002' ? 320 : row.item_id === 'item-003' ? 90 : 1200,
          happened_at: row.happened_at,
        }))
    : (
        await supabase!
          .from('inventory_movements')
          .select('item_id, movement_type, quantity_delta, unit_cost, happened_at')
          .eq('store_id', storeId)
          .gte('happened_at', monthAgo)
      ).data

  const itemList = (items ?? []) as Item[]
  const movementList = (allMovements ?? []) as MovementRow[]
  const monthList = (monthMovements ?? []) as MovementRow[]

  const stockMap = aggregateStockByItem(movementList)
  const categoryByItemId = new Map(itemList.map((item) => [item.id, item.category ?? '未分類']))

  const outboundQty = monthList
    .filter((row) => row.movement_type === 'outbound')
    .reduce((sum, row) => sum + Math.abs(toNumber(row.quantity_delta)), 0)
  const inboundQty = monthList
    .filter((row) => row.movement_type === 'inbound')
    .reduce((sum, row) => sum + toNumber(row.quantity_delta), 0)

  const stockAsset = movementList
    .filter((row) => row.movement_type === 'inbound' && toNumber(row.unit_cost) > 0)
    .reduce((sum, row) => sum + toNumber(row.quantity_delta) * toNumber(row.unit_cost), 0)

  const categoryUsage = new Map<string, number>()
  monthList
    .filter((row) => row.movement_type === 'outbound')
    .forEach((row) => {
      const category = categoryByItemId.get(row.item_id) ?? '未分類'
      const current = categoryUsage.get(category) ?? 0
      categoryUsage.set(category, current + Math.abs(toNumber(row.quantity_delta)))
    })

  const categoryRows = Array.from(categoryUsage.entries())
    .map(([category, qty]) => ({ category, qty }))
    .sort((a, b) => b.qty - a.qty)

  const lowStockCount = itemList.filter((item) => (stockMap.get(item.id) ?? 0) <= 0).length

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">在庫レポート</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">30日入庫量</p>
          <p className="text-2xl font-semibold text-gray-900">{inboundQty.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">30日出庫量</p>
          <p className="text-2xl font-semibold text-gray-900">{outboundQty.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">在庫資産(概算)</p>
          <p className="text-2xl font-semibold text-gray-900">{Math.round(stockAsset).toLocaleString()} 円</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">在庫ゼロ商品数</p>
          <p className="text-2xl font-semibold text-gray-900">{lowStockCount} 件</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">カテゴリ別出庫量（30日）</h2>
        {categoryRows.length === 0 ? (
          <p className="text-sm text-gray-500">集計データがありません。</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {categoryRows.map((row) => (
              <li key={row.category}>
                {row.category}: {row.qty.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
