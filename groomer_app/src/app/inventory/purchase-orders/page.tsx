import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { toNumber } from '@/lib/inventory/stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PurchaseOrder = {
  id: string
  order_no: string
  supplier_name: string
  status: 'draft' | 'ordered' | 'received' | 'canceled'
  ordered_on: string | null
  expected_on: string | null
  total_amount: number
  notes: string | null
  inventory_purchase_order_items?:
    | {
        id: string
        item_name: string
        quantity: number
        unit_cost: number
        notes: string | null
      }[]
    | null
}

type InventoryItem = {
  id: string
  name: string
  unit: string
}

export default async function InventoryPurchaseOrdersPage() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id, name, unit')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const { data: orders } = await supabase
    .from('inventory_purchase_orders')
    .select(
      'id, order_no, supplier_name, status, ordered_on, expected_on, total_amount, notes, inventory_purchase_order_items(id, item_name, quantity, unit_cost, notes)'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const orderList = (orders ?? []) as PurchaseOrder[]
  const itemList = (inventoryItems ?? []) as InventoryItem[]

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">発注管理</h1>
        <p className="mt-1 text-sm">
          <Link href="/inventory/reorder-suggestions" className="text-blue-600">
            発注提案一覧から下書き生成
          </Link>
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">新規発注を作成</h2>
        <form action="/api/inventory/purchase-orders" method="post" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>発注番号 (任意)</span>
            <Input name="order_no" placeholder="未入力時は自動採番" />
          </label>
          <label className="space-y-1 text-sm">
            <span>仕入先</span>
            <Input name="supplier_name" required />
          </label>
          <label className="space-y-1 text-sm">
            <span>ステータス</span>
            <select
              name="status"
              defaultValue="draft"
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="draft">下書き</option>
              <option value="ordered">発注済</option>
              <option value="received">入荷済</option>
              <option value="canceled">キャンセル</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>発注日</span>
            <Input type="date" name="ordered_on" />
          </label>
          <label className="space-y-1 text-sm">
            <span>入荷予定日</span>
            <Input type="date" name="expected_on" />
          </label>
          <label className="space-y-1 text-sm">
            <span>金額</span>
            <Input type="number" min="0" step="0.01" name="total_amount" />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>備考</span>
            <Input name="notes" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit">発注を作成</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">発注一覧</h2>
          <p className="text-sm text-gray-500">全 {orderList.length} 件</p>
        </div>
        {orderList.length === 0 ? (
          <p className="text-sm text-gray-500">発注データがありません。</p>
        ) : (
          <div className="space-y-3">
            {orderList.map((order) => (
              <article key={order.id} className="rounded border p-3 text-sm text-gray-700">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{order.order_no}</p>
                    <p>仕入先: {order.supplier_name}</p>
                    <p>ステータス: {order.status}</p>
                    <p>発注日: {order.ordered_on ?? '-'}</p>
                    <p>入荷予定日: {order.expected_on ?? '-'}</p>
                    <p>金額: {toNumber(order.total_amount).toLocaleString()} 円</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={`/api/inventory/purchase-orders/${order.id}`} method="post">
                      <input type="hidden" name="_method" value="put" />
                      <input type="hidden" name="supplier_name" value={order.supplier_name} />
                      <input type="hidden" name="ordered_on" value={order.ordered_on ?? ''} />
                      <input type="hidden" name="expected_on" value={order.expected_on ?? ''} />
                      <input type="hidden" name="total_amount" value={String(order.total_amount ?? 0)} />
                      <input type="hidden" name="notes" value={order.notes ?? ''} />
                      <select
                        name="status"
                        defaultValue={order.status}
                        className="rounded border p-1.5 text-sm"
                      >
                        <option value="draft">下書き</option>
                        <option value="ordered">発注済</option>
                        <option value="received">入荷済</option>
                        <option value="canceled">キャンセル</option>
                      </select>
                      <Button type="submit" className="ml-2">
                        更新
                      </Button>
                    </form>
                    <form action={`/api/inventory/purchase-orders/${order.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="bg-red-500 hover:bg-red-600">
                        削除
                      </Button>
                    </form>
                  </div>
                </div>
                <div className="mt-3 rounded bg-gray-50 p-3">
                  <p className="mb-2 font-semibold text-gray-900">発注明細</p>
                  {(order.inventory_purchase_order_items ?? []).length === 0 ? (
                    <p className="text-xs text-gray-500">明細が未登録です。</p>
                  ) : (
                    <div className="space-y-2">
                      {(order.inventory_purchase_order_items ?? []).map((line) => (
                        <div
                          key={line.id}
                          className="flex flex-col gap-2 rounded border bg-white p-2 md:flex-row md:items-center md:justify-between"
                        >
                          <p className="text-xs text-gray-700">
                            {line.item_name} / {toNumber(line.quantity)} x {toNumber(line.unit_cost).toLocaleString()} 円
                          </p>
                          <form action={`/api/inventory/purchase-order-items/${line.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="bg-red-500 px-2 py-1 text-xs hover:bg-red-600">
                              明細削除
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    action={`/api/inventory/purchase-orders/${order.id}/items`}
                    method="post"
                    className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4"
                  >
                    <label className="space-y-1 text-xs">
                      <span>商品</span>
                      <select
                        name="item_id"
                        className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                        defaultValue=""
                      >
                        <option value="">任意（自由入力）</option>
                        {itemList.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>明細名</span>
                      <Input name="item_name" required />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>数量</span>
                      <Input type="number" name="quantity" step="0.01" min="0.01" required />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>単価</span>
                      <Input type="number" name="unit_cost" step="0.01" min="0" required />
                    </label>
                    <div className="md:col-span-4">
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        明細を追加
                      </Button>
                    </div>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
