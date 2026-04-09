import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { inventoryPageFixtures } from '@/lib/e2e/inventory-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

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
    modal?: string
    edit?: string
  }>
}

export default async function InventoryProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams
  const isCreateModalOpen = resolvedSearchParams?.modal === 'create'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = '/inventory/products'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: inventoryPageFixtures.storeId }
    : await createStoreScopedClient()

  const items = isPlaywrightE2E
    ? inventoryPageFixtures.productItems
    : (
        await supabase!
          .from('inventory_items')
          .select(
            'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
          )
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const editItem = isPlaywrightE2E
    ? inventoryPageFixtures.productItems.find((item) => item.id === editId) ?? null
    : editId
      ? (
          await supabase!
            .from('inventory_items')
            .select(
              'id, name, category, unit, supplier_name, jan_code, optimal_stock, reorder_point, lead_time_days, preferred_supplier_name, minimum_order_quantity, order_lot_size, is_active, notes'
            )
            .eq('id', editId)
            .eq('store_id', storeId)
            .single()
        ).data
      : null

  const itemList = (items ?? []) as Item[]
  const currentEdit = (editItem as Item | null) ?? null

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">商品マスタ管理</h1>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">商品一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {itemList.length} 件</p>
            <Link
              href="/inventory/products?modal=create"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              新規登録
            </Link>
          </div>
        </div>
        {itemList.length === 0 ? (
          <p className="text-sm text-gray-500">商品がまだ登録されていません。</p>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {itemList.map((item) => (
                <article key={item.id} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <p className="truncate font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.category ?? '未設定'} / {item.unit} / {item.preferred_supplier_name ?? item.supplier_name ?? '未設定'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      発注点 {item.reorder_point}
                    </span>
                    <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      適正在庫 {item.optimal_stock}
                    </span>
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                        item.is_active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}
                    >
                      {item.is_active ? '有効' : '無効'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">備考: {item.notes ?? 'なし'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/inventory/products?edit=${item.id}`}
                      className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      編集
                    </Link>
                    <form action={`/api/inventory/items/${item.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden md:block" data-testid="inventory-products-table-wrap">
              <table className="min-w-full table-fixed text-left text-sm" data-testid="inventory-products-table">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">商品</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">在庫基準</th>
                    <th className="px-2.5 py-2">状態</th>
                    <th className="px-2.5 py-2">備考</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemList.map((item) => (
                    <tr key={item.id} className="text-gray-700" data-testid={`inventory-product-row-${item.id}`}>
                      <td className="px-2.5 py-2 align-top">
                        <p className="truncate font-medium text-gray-900">{item.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {item.category ?? '未設定'} / {item.unit}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {item.preferred_supplier_name ?? item.supplier_name ?? '未設定'}
                        </p>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap align-top">
                        <p>発注点 {item.reorder_point}</p>
                        <p className="text-xs text-gray-500">適正在庫 {item.optimal_stock}</p>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                            item.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-gray-50 text-gray-500'
                          }`}
                        >
                          {item.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <p className="line-clamp-2">{item.notes ?? 'なし'}</p>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/inventory/products?edit=${item.id}`}
                            className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            編集
                          </Link>
                          <form action={`/api/inventory/items/${item.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
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
          </>
        )}
      </Card>

      {isCreateModalOpen || currentEdit ? (
        <FormModal
          title={currentEdit ? '商品情報の更新' : '新規商品登録'}
          closeRedirectTo={modalCloseRedirect}
          description="商品情報はモーダルで入力します。"
          reopenLabel="商品モーダルを開く"
        >
          <form
            action={currentEdit ? `/api/inventory/items/${currentEdit.id}` : '/api/inventory/items'}
            method="post"
            className="space-y-4"
          >
            {currentEdit && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                商品名
                <Input name="name" required defaultValue={currentEdit?.name ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                カテゴリ
                <Input name="category" defaultValue={currentEdit?.category ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                単位
                <Input name="unit" defaultValue={currentEdit?.unit ?? '個'} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                仕入先
                <Input name="supplier_name" defaultValue={currentEdit?.supplier_name ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                推奨仕入先
                <Input
                  name="preferred_supplier_name"
                  defaultValue={currentEdit?.preferred_supplier_name ?? ''}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                JANコード
                <Input name="jan_code" defaultValue={currentEdit?.jan_code ?? ''} />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                適正在庫
                <Input
                  type="number"
                  step="0.01"
                  name="optimal_stock"
                  defaultValue={String(currentEdit?.optimal_stock ?? 0)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                発注点
                <Input
                  type="number"
                  step="0.01"
                  name="reorder_point"
                  defaultValue={String(currentEdit?.reorder_point ?? 0)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                リードタイム日数
                <Input
                  type="number"
                  min="0"
                  step="1"
                  name="lead_time_days"
                  defaultValue={String(currentEdit?.lead_time_days ?? 0)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                最小発注数
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  name="minimum_order_quantity"
                  defaultValue={String(currentEdit?.minimum_order_quantity ?? 0)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                発注ロット
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  name="order_lot_size"
                  defaultValue={String(currentEdit?.order_lot_size ?? 0)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                有効/無効
                <select
                  name="is_active"
                  defaultValue={currentEdit?.is_active ?? true ? 'true' : 'false'}
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                備考
                <Input name="notes" defaultValue={currentEdit?.notes ?? ''} />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{currentEdit ? '更新する' : '登録する'}</Button>
              {currentEdit && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </FormModal>
      ) : null}
    </section>
  )
}
