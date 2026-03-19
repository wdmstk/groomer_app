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
  category: string | null
  unit: string
  supplier_name: string | null
  optimal_stock: number
}

type StocksPageProps = {
  searchParams?: Promise<{
    low?: string
  }>
}

export default async function InventoryStocksPage({ searchParams }: StocksPageProps) {
  const resolvedSearchParams = await searchParams
  const lowOnly = resolvedSearchParams?.low === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()

  const items = isPlaywrightE2E
    ? inventoryPageFixtures.productItems.filter((item) => item.is_active)
    : (
        await supabase!
          .from('inventory_items')
          .select('id, name, category, unit, supplier_name, optimal_stock')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      ).data

  const itemList = (items ?? []) as Item[]
  const itemIds = itemList.map((item) => item.id)

  const movementRows = isPlaywrightE2E
    ? inventoryPageFixtures.dashboardMovements
        .filter((row) => itemIds.includes(row.item_id))
        .map((row) => ({ item_id: row.item_id, quantity_delta: row.quantity_delta }))
    : itemIds.length > 0
      ? (
          await supabase!
            .from('inventory_movements')
            .select('item_id, quantity_delta')
            .eq('store_id', storeId)
            .in('item_id', itemIds)
        ).data
      : []

  const stockMap = aggregateStockByItem(movementRows ?? [])
  const rows = itemList
    .map((item) => {
      const currentStock = stockMap.get(item.id) ?? 0
      const optimalStock = toNumber(item.optimal_stock)
      const isLow = currentStock < optimalStock
      return {
        ...item,
        currentStock,
        optimalStock,
        isLow,
      }
    })
    .filter((row) => (lowOnly ? row.isLow : true))

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">在庫一覧</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/inventory/stocks/export"
            className="rounded bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white"
          >
            CSV出力
          </Link>
          <Link
            href="/inventory/stocks"
            className={`rounded px-3 py-1.5 text-sm ${lowOnly ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 font-semibold text-blue-700'}`}
          >
            全件
          </Link>
          <Link
            href="/inventory/stocks?low=1"
            className={`rounded px-3 py-1.5 text-sm ${lowOnly ? 'bg-blue-100 font-semibold text-blue-700' : 'bg-gray-100 text-gray-700'}`}
          >
            不足のみ
          </Link>
        </div>
      </div>

      <Card>
        <div className="mb-3 text-sm text-gray-600">表示件数: {rows.length} 件</div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">表示できる在庫データがありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">商品名</th>
                  <th className="px-2 py-2">カテゴリ</th>
                  <th className="px-2 py-2">現在庫</th>
                  <th className="px-2 py-2">適正在庫</th>
                  <th className="px-2 py-2">仕入先</th>
                  <th className="px-2 py-2">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="text-gray-700">
                    <td className="px-2 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-2 py-3">{row.category ?? '未設定'}</td>
                    <td className="px-2 py-3">
                      {row.currentStock} {row.unit}
                    </td>
                    <td className="px-2 py-3">
                      {row.optimalStock} {row.unit}
                    </td>
                    <td className="px-2 py-3">{row.supplier_name ?? '未設定'}</td>
                    <td className="px-2 py-3">{row.isLow ? '不足' : '正常'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}
