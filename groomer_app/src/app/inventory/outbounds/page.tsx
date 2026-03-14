import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Item = {
  id: string
  name: string
  unit: string
}

type MovementRow = {
  id: string
  quantity_delta: number
  reason: string | null
  happened_at: string
  inventory_items?: { name: string; unit: string } | { name: string; unit: string }[] | null
}

function relatedItem(value: MovementRow['inventory_items']) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function InventoryOutboundsPage() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, unit')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const { data: outbounds } = await supabase
    .from('inventory_movements')
    .select('id, quantity_delta, reason, happened_at, inventory_items(name, unit)')
    .eq('store_id', storeId)
    .eq('movement_type', 'outbound')
    .order('happened_at', { ascending: false })
    .limit(20)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">出庫登録</h1>
      </div>

      <Card>
        <form action="/api/inventory/movements" method="post" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="movement_type" value="outbound" />
          <label className="space-y-1 text-sm">
            <span>商品</span>
            <select
              name="item_id"
              required
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">商品を選択</option>
              {((items ?? []) as Item[]).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>数量</span>
            <Input type="number" step="0.01" min="0.01" name="quantity" required />
          </label>
          <label className="space-y-1 text-sm">
            <span>出庫理由</span>
            <select
              name="reason"
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
              defaultValue="施術利用"
            >
              <option>施術利用</option>
              <option>店販売上</option>
              <option>廃棄</option>
              <option>その他</option>
            </select>
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
            <Button type="submit">出庫を登録</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最新の出庫履歴</h2>
          <p className="text-sm text-gray-500">全 {((outbounds ?? []) as MovementRow[]).length} 件</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">商品</th>
                <th className="px-2 py-2">数量</th>
                <th className="px-2 py-2">理由</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {((outbounds ?? []) as MovementRow[]).map((row) => {
                const item = relatedItem(row.inventory_items)
                const qty = Math.abs(toNumber(row.quantity_delta))
                return (
                  <tr key={row.id} className="text-gray-700">
                    <td className="px-2 py-3">{new Date(row.happened_at).toLocaleString('ja-JP')}</td>
                    <td className="px-2 py-3 font-medium text-gray-900">{item?.name ?? '不明な商品'}</td>
                    <td className="px-2 py-3">
                      -{qty} {item?.unit ?? ''}
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
