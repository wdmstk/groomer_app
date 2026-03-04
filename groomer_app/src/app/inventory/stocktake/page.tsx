import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { aggregateStockByItem } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Item = {
  id: string
  name: string
  unit: string
}

type MovementRow = {
  id: string
  item_id: string
  quantity_delta: number
  reason: string | null
  happened_at: string
  inventory_items?: { name: string; unit: string } | { name: string; unit: string }[] | null
}

function relatedItem(value: MovementRow['inventory_items']) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function InventoryStocktakePage() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, unit')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const itemList = (items ?? []) as Item[]
  const itemIds = itemList.map((item) => item.id)
  const { data: movementRows } =
    itemIds.length > 0
      ? await supabase
          .from('inventory_movements')
          .select('item_id, quantity_delta')
          .eq('store_id', storeId)
          .in('item_id', itemIds)
      : { data: [] }
  const stockMap = aggregateStockByItem(movementRows ?? [])

  const { data: stocktakeRows } = await supabase
    .from('inventory_movements')
    .select('id, item_id, quantity_delta, reason, happened_at, inventory_items(name, unit)')
    .eq('store_id', storeId)
    .eq('movement_type', 'stocktake_adjustment')
    .order('happened_at', { ascending: false })
    .limit(20)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">棚卸</h1>
        <p className="text-sm text-gray-600">実在庫との差異を記録し、在庫を調整します。</p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">棚卸調整を登録</h2>
        <form action="/api/inventory/stocktake" method="post" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>商品</span>
            <select
              name="item_id"
              required
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">商品を選択</option>
              {itemList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (帳簿在庫: {stockMap.get(item.id) ?? 0} {item.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>実在庫</span>
            <Input type="number" step="0.01" min="0" name="actual_quantity" required />
          </label>
          <label className="space-y-1 text-sm">
            <span>理由</span>
            <Input name="reason" defaultValue="棚卸調整" />
          </label>
          <label className="space-y-1 text-sm">
            <span>実施日</span>
            <Input type="datetime-local" name="happened_at" />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>備考</span>
            <Input name="notes" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit">差異を反映</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">最新の棚卸調整履歴</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">商品</th>
                <th className="px-2 py-2">調整量</th>
                <th className="px-2 py-2">理由</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {((stocktakeRows ?? []) as MovementRow[]).map((row) => {
                const item = relatedItem(row.inventory_items)
                const delta = row.quantity_delta > 0 ? `+${row.quantity_delta}` : String(row.quantity_delta)
                return (
                  <tr key={row.id} className="text-gray-700">
                    <td className="px-2 py-3">{new Date(row.happened_at).toLocaleString('ja-JP')}</td>
                    <td className="px-2 py-3 font-medium text-gray-900">{item?.name ?? '不明な商品'}</td>
                    <td className="px-2 py-3">
                      {delta} {item?.unit ?? ''}
                    </td>
                    <td className="px-2 py-3">{row.reason ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
