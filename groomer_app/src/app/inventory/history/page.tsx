import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type HistoryRow = {
  id: string
  movement_type: 'inbound' | 'outbound' | 'stocktake_adjustment'
  quantity_delta: number
  reason: string | null
  happened_at: string
  inventory_items?: { name: string; unit: string } | { name: string; unit: string }[] | null
}

function relatedItem(value: HistoryRow['inventory_items']) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function movementLabel(type: HistoryRow['movement_type']) {
  if (type === 'inbound') return '入庫'
  if (type === 'outbound') return '出庫'
  return '棚卸調整'
}

export default async function InventoryHistoryPage() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data } = await supabase
    .from('inventory_movements')
    .select('id, movement_type, quantity_delta, reason, happened_at, inventory_items(name, unit)')
    .eq('store_id', storeId)
    .order('happened_at', { ascending: false })
    .limit(100)

  const rows = (data ?? []) as HistoryRow[]

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">在庫履歴</h1>
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">履歴がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">日時</th>
                  <th className="px-2 py-2">商品</th>
                  <th className="px-2 py-2">区分</th>
                  <th className="px-2 py-2">数量</th>
                  <th className="px-2 py-2">理由</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const item = relatedItem(row.inventory_items)
                  const delta = toNumber(row.quantity_delta)
                  return (
                    <tr key={row.id} className="text-gray-700">
                      <td className="px-2 py-3">{new Date(row.happened_at).toLocaleString('ja-JP')}</td>
                      <td className="px-2 py-3 font-medium text-gray-900">{item?.name ?? '不明な商品'}</td>
                      <td className="px-2 py-3">{movementLabel(row.movement_type)}</td>
                      <td className="px-2 py-3">
                        {delta > 0 ? `+${delta}` : delta} {item?.unit ?? ''}
                      </td>
                      <td className="px-2 py-3">{row.reason ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}
