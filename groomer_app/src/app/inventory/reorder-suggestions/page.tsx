import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { groupSuggestionsBySupplier, type ReorderSuggestionRow } from '@/lib/inventory/reorder'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default async function InventoryReorderSuggestionsPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()
  const suggestions = isPlaywrightE2E
    ? inventoryPageFixtures.reorderSuggestions
    : (
        await supabase!
          .from('inventory_reorder_suggestion_v')
          .select(
            'item_id, item_name, category, unit, supplier_name, current_stock, reorder_point, optimal_stock, minimum_order_quantity, order_lot_size, lead_time_days, last_inbound_unit_cost, recommended_quantity, priority_rank'
          )
          .eq('store_id', storeId)
          .order('priority_rank', { ascending: true })
      ).data

  const suggestionList = (suggestions ?? []) as ReorderSuggestionRow[]
  const groupedSuggestions = Array.from(groupSuggestionsBySupplier(suggestionList).entries())
  const highRiskSuggestions = suggestionList.filter((row) => {
    const currentStock = toNumber(row.current_stock)
    const reorderPoint = toNumber(row.reorder_point)
    const priorityRank = toNumber(row.priority_rank)
    return currentStock <= reorderPoint && priorityRank > 0 && priorityRank <= 5
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">発注提案一覧</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/products?tab=list" className="rounded border px-3 py-2 text-sm text-gray-700">
            商品マスタ
          </Link>
          <Link href="/inventory/purchase-orders" className="rounded border px-3 py-2 text-sm text-gray-700">
            発注管理
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">提案対象商品</p>
          <p className="text-2xl font-semibold text-gray-900">{suggestionList.length} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">仕入先グループ</p>
          <p className="text-2xl font-semibold text-gray-900">{groupedSuggestions.length} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">ドラフト生成方針</p>
          <p className="text-sm font-semibold text-gray-900">仕入先ごとに下書き発注を1件作成</p>
        </Card>
      </div>
      <Card className={highRiskSuggestions.length > 0 ? 'border border-rose-300 bg-rose-50' : ''}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">欠品予兆（優先監視）</p>
            <p className="text-2xl font-semibold text-gray-900">{highRiskSuggestions.length} 件</p>
          </div>
          <Link href="/inventory/purchase-orders" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            発注ドラフトへ
          </Link>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">提案一覧</h2>
          </div>
        </div>

        {suggestionList.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">提案対象の商品はありません。</p>
          </div>
        ) : (
          <form action="/api/inventory/purchase-orders/draft-from-suggestions" method="post" className="space-y-6">
            {groupedSuggestions.map(([supplierName, rows]) => (
              <div key={supplierName} className="rounded border bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{supplierName}</h3>
                    <p className="text-xs text-gray-500">{rows.length} 商品</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.item_id} className="rounded border bg-white p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
                        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                          <input type="checkbox" name="selected_item_id" value={row.item_id} defaultChecked />
                          <span>
                            <span className="font-semibold text-gray-900">{row.item_name}</span>
                            <span className="block text-xs text-gray-500">
                              現在庫 {row.current_stock ?? 0} / 発注点 {row.reorder_point ?? 0} / 適正在庫 {row.optimal_stock ?? 0}
                            </span>
                          </span>
                        </label>
                        <label className="space-y-1 text-xs text-gray-700">
                          <span>仕入先</span>
                          <Input name={`supplier_name_${row.item_id}`} defaultValue={row.supplier_name ?? supplierName} />
                        </label>
                        <label className="space-y-1 text-xs text-gray-700">
                          <span>推奨数量</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            name={`recommended_quantity_${row.item_id}`}
                            defaultValue={String(row.recommended_quantity ?? 0)}
                          />
                        </label>
                        <label className="space-y-1 text-xs text-gray-700">
                          <span>単価</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            name={`unit_cost_${row.item_id}`}
                            defaultValue={String(row.last_inbound_unit_cost ?? 0)}
                          />
                        </label>
                        <div className="text-xs text-gray-600">
                          <p>単位</p>
                          <p className="font-semibold text-gray-900">{row.unit}</p>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>リードタイム</p>
                          <p className="font-semibold text-gray-900">{row.lead_time_days ?? 0} 日</p>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>優先度</p>
                          <p className="font-semibold text-gray-900">#{row.priority_rank ?? '-'}</p>
                          {toNumber(row.current_stock) <= toNumber(row.reorder_point) &&
                          toNumber(row.priority_rank) > 0 &&
                          toNumber(row.priority_rank) <= 5 ? (
                            <span className="mt-1 inline-flex rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              欠品高リスク
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Button type="submit">選択商品からドラフト作成</Button>
              <Link href="/inventory/purchase-orders" className="text-sm text-gray-500">
                発注管理へ戻る
              </Link>
            </div>
          </form>
        )}
      </Card>
    </section>
  )
}
