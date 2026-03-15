import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStoreScopedClient } from '@/lib/supabase/store'

const InventoryItemModal = nextDynamic(
  () => import('@/components/inventory/InventoryItemModal').then((mod) => mod.InventoryItemModal)
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Item = {
  id: string
  name: string
  category: string | null
  unit: string
  supplier_name: string | null
  jan_code: string | null
  optimal_stock: number
  reorder_point: number
  lead_time_days: number
  preferred_supplier_name: string | null
  minimum_order_quantity: number
  order_lot_size: number
  is_active: boolean
  notes: string | null
}

type ProductsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
  }>
}

export default async function InventoryProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/inventory/products?tab=${activeTab}`
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: items } = await supabase
    .from('inventory_items')
    .select(
      'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: editItem } = editId
    ? await supabase
        .from('inventory_items')
        .select(
          'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const itemList = (items ?? []) as Item[]
  const currentEdit = (editItem as Item | null) ?? null

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">商品マスタ管理</h1>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/inventory/products?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          商品一覧
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">商品一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {itemList.length} 件</p>
            <Link
              href="/inventory/products?tab=list&modal=create"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              新規登録
            </Link>
          </div>
        </div>
        {itemList.length === 0 ? (
          <p className="text-sm text-gray-500">商品がまだ登録されていません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">商品名</th>
                  <th className="px-2 py-2">カテゴリ</th>
                  <th className="px-2 py-2">単位</th>
                  <th className="px-2 py-2">仕入先</th>
                  <th className="px-2 py-2">発注点</th>
                  <th className="px-2 py-2">適正在庫</th>
                  <th className="px-2 py-2">状態</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itemList.map((item) => (
                  <tr key={item.id} className="text-gray-700">
                    <td className="px-2 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-2 py-3">{item.category ?? '未設定'}</td>
                    <td className="px-2 py-3">{item.unit}</td>
                    <td className="px-2 py-3">{item.preferred_supplier_name ?? item.supplier_name ?? '未設定'}</td>
                    <td className="px-2 py-3">{item.reorder_point}</td>
                    <td className="px-2 py-3">{item.optimal_stock}</td>
                    <td className="px-2 py-3">{item.is_active ? '有効' : '無効'}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/inventory/products?tab=list&edit=${item.id}`} className="text-sm text-blue-600">
                          編集
                        </Link>
                        <form action={`/api/inventory/items/${item.id}`} method="post">
                          <input type="hidden" name="_method" value="delete" />
                          <Button type="submit" className="bg-red-500 hover:bg-red-600">
                            削除
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isCreateModalOpen || currentEdit ? (
        <InventoryItemModal currentEdit={currentEdit} modalCloseRedirect={modalCloseRedirect} />
      ) : null}
    </section>
  )
}
