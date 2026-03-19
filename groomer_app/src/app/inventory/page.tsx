import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { aggregateStockByItem, toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type Item = {
  id: string
  name: string
  unit: string
  optimal_stock: number
}

type Movement = {
  item_id: string
  movement_type: 'inbound' | 'outbound' | 'stocktake_adjustment'
  quantity_delta: number
  expires_on: string | null
  happened_at: string
}

function startOfTodayIso() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return start.toISOString()
}

export default async function InventoryDashboardPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()
  const now = isPlaywrightE2E ? new Date(inventoryPageFixtures.dashboardNowIso) : new Date()
  const todayIso = startOfTodayIso()
  const soonDate = new Date(now)
  soonDate.setDate(soonDate.getDate() + 14)
  const soon = soonDate.toISOString().slice(0, 10)

  const items = isPlaywrightE2E
    ? inventoryPageFixtures.dashboardItems
    : (
        await supabase!
          .from('inventory_items')
          .select('id, name, unit, optimal_stock')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      ).data

  const movements = isPlaywrightE2E
    ? inventoryPageFixtures.dashboardMovements
    : (
        await supabase!
          .from('inventory_movements')
          .select('item_id, movement_type, quantity_delta, expires_on, happened_at')
          .eq('store_id', storeId)
      ).data

  const itemList = (items ?? []) as Item[]
  const movementList = (movements ?? []) as Movement[]
  const stockMap = aggregateStockByItem(movementList)

  const lowStockRows = itemList
    .map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      optimalStock: toNumber(item.optimal_stock),
      currentStock: stockMap.get(item.id) ?? 0,
    }))
    .filter((row) => row.currentStock < row.optimalStock)
    .sort((a, b) => a.currentStock - b.currentStock)

  const expiringIds = new Set(
    movementList
      .filter((row) => row.expires_on && row.expires_on <= soon)
      .map((row) => row.item_id)
  )

  const todayInbounds = movementList.filter(
    (row) => row.movement_type === 'inbound' && row.happened_at >= todayIso
  ).length
  const todayOutbounds = movementList.filter(
    (row) => row.movement_type === 'outbound' && row.happened_at >= todayIso
  ).length

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">在庫ダッシュボード</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/reorder-suggestions" className="rounded border px-3 py-2 text-sm font-semibold text-gray-700">
            発注提案
          </Link>
          <Link href="/inventory/inbounds" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
            入庫登録
          </Link>
          <Link href="/inventory/outbounds" className="rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-white">
            出庫登録
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">不足商品</p>
          <p className="text-2xl font-semibold text-gray-900">{lowStockRows.length} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">期限切れ間近（14日）</p>
          <p className="text-2xl font-semibold text-gray-900">{expiringIds.size} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">本日入庫</p>
          <p className="text-2xl font-semibold text-gray-900">{todayInbounds} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">本日出庫</p>
          <p className="text-2xl font-semibold text-gray-900">{todayOutbounds} 件</p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">不足アラート</h2>
          <div className="flex items-center gap-3">
            <Link href="/inventory/reorder-suggestions" className="text-sm text-blue-600">
              発注提案一覧へ
            </Link>
            <Link href="/inventory/stocks?low=1" className="text-sm text-blue-600">
              在庫一覧へ
            </Link>
          </div>
        </div>
        {lowStockRows.length === 0 ? (
          <p className="text-sm text-gray-500">不足商品はありません。</p>
        ) : (
          <div className="space-y-2">
            {lowStockRows.slice(0, 10).map((row) => (
              <div key={row.id} className="rounded border p-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">{row.name}</p>
                <p>
                  現在庫: {row.currentStock} {row.unit} / 適正在庫: {row.optimalStock} {row.unit}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
