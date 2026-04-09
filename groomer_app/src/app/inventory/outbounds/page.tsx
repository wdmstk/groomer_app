import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

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
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()
  const items = isPlaywrightE2E
    ? inventoryPageFixtures.outboundItems
    : (
        await supabase!
          .from('inventory_items')
          .select('id, name, unit')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      ).data

  const outbounds = isPlaywrightE2E
    ? inventoryPageFixtures.outboundRows
    : (
        await supabase!
          .from('inventory_movements')
          .select('id, quantity_delta, reason, happened_at, inventory_items(name, unit)')
          .eq('store_id', storeId)
          .eq('movement_type', 'outbound')
          .order('happened_at', { ascending: false })
          .limit(20)
      ).data

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
        <div className="space-y-2.5 md:hidden">
          {((outbounds ?? []) as MovementRow[]).map((row) => {
            const item = relatedItem(row.inventory_items)
            const qty = Math.abs(toNumber(row.quantity_delta))
            return (
              <article key={row.id} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
                <p className="truncate font-semibold text-gray-900">{item?.name ?? '不明な商品'}</p>
                <p className="text-xs text-gray-500">{new Date(row.happened_at).toLocaleString('ja-JP')}</p>
                <p className="mt-2 font-medium text-gray-900">
                  -{qty} {item?.unit ?? ''}
                </p>
                <p className="text-xs text-gray-600">理由: {row.reason ?? '-'}</p>
              </article>
            )
          })}
        </div>
        <div className="hidden md:block" data-testid="inventory-outbounds-table-wrap">
          <table className="min-w-full table-fixed text-left text-sm" data-testid="inventory-outbounds-table">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2.5 py-2">商品</th>
                <th className="px-2.5 py-2 whitespace-nowrap">数量</th>
                <th className="px-2.5 py-2">日時/理由</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {((outbounds ?? []) as MovementRow[]).map((row) => {
                const item = relatedItem(row.inventory_items)
                const qty = Math.abs(toNumber(row.quantity_delta))
                return (
                  <tr key={row.id} className="text-gray-700" data-testid={`inventory-outbound-row-${row.id}`}>
                    <td className="px-2.5 py-2 align-top">
                      <p className="truncate font-medium text-gray-900">{item?.name ?? '不明な商品'}</p>
                      <p className="text-xs text-gray-500">{item?.unit ?? ''}</p>
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap align-top">
                      -{qty} {item?.unit ?? ''}
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <p>{new Date(row.happened_at).toLocaleString('ja-JP')}</p>
                      <p className="truncate text-xs text-gray-500">{row.reason ?? '-'}</p>
                    </td>
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
