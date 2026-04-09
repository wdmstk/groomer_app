import { Card } from '@/components/ui/Card'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type HistoryRow = {
  id: string
  movement_type: 'inbound' | 'outbound' | 'stocktake_adjustment'
  quantity_delta: number
  reason: string | null
  notes: string | null
  happened_at: string
  inventory_items?: { name: string; unit: string } | { name: string; unit: string }[] | null
}

type HistorySourceFilter = 'all' | 'pos_auto' | 'manual'

function relatedItem(value: HistoryRow['inventory_items']) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function movementLabel(type: HistoryRow['movement_type']) {
  if (type === 'inbound') return '入庫'
  if (type === 'outbound') return '出庫'
  return '棚卸調整'
}

function isPosAutoMovement(row: HistoryRow) {
  return row.notes?.startsWith('POS_OUTBOUND:') || row.notes?.startsWith('POS_VOID_REVERT:')
}

function normalizeHistorySourceFilter(value: string | undefined): HistorySourceFilter {
  if (value === 'pos_auto' || value === 'manual') return value
  return 'all'
}

export default async function InventoryHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const sourceFilter = normalizeHistorySourceFilter(resolvedSearchParams?.source)
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()
  const data = isPlaywrightE2E
    ? inventoryPageFixtures.historyRows
    : (
        await supabase!
          .from('inventory_movements')
          .select('id, movement_type, quantity_delta, reason, notes, happened_at, inventory_items(name, unit)')
          .eq('store_id', storeId)
          .order('happened_at', { ascending: false })
          .limit(100)
      ).data

  const rows = ((data ?? []) as HistoryRow[]).filter((row) => {
    if (sourceFilter === 'all') return true
    if (sourceFilter === 'pos_auto') return isPosAutoMovement(row)
    return !isPosAutoMovement(row)
  })

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">在庫履歴</h1>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-700">起票種別:</span>
          <Link
            href="/inventory/history"
            className={`rounded border px-3 py-1.5 ${
              sourceFilter === 'all' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            すべて
          </Link>
          <Link
            href="/inventory/history?source=pos_auto"
            className={`rounded border px-3 py-1.5 ${
              sourceFilter === 'pos_auto' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            POS自動起票のみ
          </Link>
          <Link
            href="/inventory/history?source=manual"
            className={`rounded border px-3 py-1.5 ${
              sourceFilter === 'manual' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            手動起票のみ
          </Link>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">履歴がありません。</p>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {rows.map((row) => {
                const item = relatedItem(row.inventory_items)
                const delta = toNumber(row.quantity_delta)
                return (
                  <article key={row.id} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
                    <p className="truncate font-semibold text-gray-900">{item?.name ?? '不明な商品'}</p>
                    <p className="text-xs text-gray-500">{new Date(row.happened_at).toLocaleString('ja-JP')}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {movementLabel(row.movement_type)}
                      </span>
                      <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {delta > 0 ? `+${delta}` : delta} {item?.unit ?? ''}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">理由: {row.reason ?? '-'}</p>
                  </article>
                )
              })}
            </div>
            <div className="hidden md:block" data-testid="inventory-history-table-wrap">
              <table className="min-w-full table-fixed text-left text-sm" data-testid="inventory-history-table">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">商品</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">区分/数量</th>
                    <th className="px-2.5 py-2">日時/理由</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const item = relatedItem(row.inventory_items)
                    const delta = toNumber(row.quantity_delta)
                    return (
                      <tr key={row.id} className="text-gray-700" data-testid={`inventory-history-row-${row.id}`}>
                        <td className="px-2.5 py-2 align-top">
                          <p className="truncate font-medium text-gray-900">{item?.name ?? '不明な商品'}</p>
                          <p className="text-xs text-gray-500">{item?.unit ?? ''}</p>
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap align-top">
                          <p>{movementLabel(row.movement_type)}</p>
                          <p className="text-xs text-gray-500">{delta > 0 ? `+${delta}` : delta} {item?.unit ?? ''}</p>
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
          </>
        )}
      </Card>
    </section>
  )
}
