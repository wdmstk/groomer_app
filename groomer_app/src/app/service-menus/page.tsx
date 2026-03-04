import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ServiceMenusPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
  }>
}

const categoryOptions = ['シャンプー', 'カット', 'オプション', 'その他']

export default async function ServiceMenusPage({ searchParams }: ServiceMenusPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/service-menus?tab=${activeTab}`
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: menus } = await supabase
    .from('service_menus')
    .select(
      'id, name, category, price, duration, tax_rate, tax_included, is_active, display_order, notes'
    )
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  const { data: editMenu } = editId
    ? await supabase
        .from('service_menus')
        .select(
          'id, name, category, price, duration, tax_rate, tax_included, is_active, display_order, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const menuList = menus ?? []

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">施術メニュー管理</h1>
        <p className="text-gray-600">施術メニューの登録・更新・削除が行えます。</p>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/service-menus?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          メニュー一覧
        </Link>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">メニュー一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {menuList.length} 件</p>
            <Link
              href="/service-menus?tab=list&modal=create"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              新規登録
            </Link>
          </div>
        </div>
        {menuList.length === 0 ? (
          <p className="text-sm text-gray-500">メニューがまだ登録されていません。</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {menuList.map((menu) => (
                <article key={menu.id} className="rounded border p-3 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{menu.name}</p>
                  <p>カテゴリ: {menu.category ?? '未設定'}</p>
                  <p>価格: {menu.price.toLocaleString()} 円</p>
                  <p>時間: {menu.duration} 分</p>
                  <p>税率: {menu.tax_rate ?? 0.1}</p>
                  <p>税込: {menu.tax_included ? '税込' : '税抜'}</p>
                  <p>有効: {menu.is_active ? '有効' : '無効'}</p>
                  <p>表示順: {menu.display_order ?? 0}</p>
                  <p>備考: {menu.notes ?? 'なし'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      href={`/service-menus?tab=list&edit=${menu.id}`}
                      className="text-blue-600 text-sm"
                    >
                      編集
                    </Link>
                    <form action={`/api/service-menus/${menu.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="bg-red-500 hover:bg-red-600">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm text-left">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="py-2 px-2">メニュー</th>
                    <th className="py-2 px-2">カテゴリ</th>
                    <th className="py-2 px-2">価格</th>
                    <th className="py-2 px-2">時間</th>
                    <th className="py-2 px-2">税率</th>
                    <th className="py-2 px-2">税込</th>
                    <th className="py-2 px-2">有効</th>
                    <th className="py-2 px-2">表示順</th>
                    <th className="py-2 px-2">備考</th>
                    <th className="py-2 px-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {menuList.map((menu) => (
                    <tr key={menu.id} className="text-gray-700">
                      <td className="py-3 px-2 font-medium text-gray-900">{menu.name}</td>
                      <td className="py-3 px-2">{menu.category ?? '未設定'}</td>
                      <td className="py-3 px-2">{menu.price.toLocaleString()} 円</td>
                      <td className="py-3 px-2">{menu.duration} 分</td>
                      <td className="py-3 px-2">{menu.tax_rate ?? 0.1}</td>
                      <td className="py-3 px-2">{menu.tax_included ? '税込' : '税抜'}</td>
                      <td className="py-3 px-2">{menu.is_active ? '有効' : '無効'}</td>
                      <td className="py-3 px-2">{menu.display_order ?? 0}</td>
                      <td className="py-3 px-2">{menu.notes ?? 'なし'}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/service-menus?tab=list&edit=${menu.id}`}
                            className="text-blue-600 text-sm"
                          >
                            編集
                          </Link>
                          <form action={`/api/service-menus/${menu.id}`} method="post">
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
          </>
        )}
      </Card>

      {isCreateModalOpen || editMenu ? (
        <FormModal
          title={editMenu ? 'メニューの更新' : '新規メニュー登録'}
          closeRedirectTo={modalCloseRedirect}
          description="施術メニューはモーダルで入力します。"
          reopenLabel="メニューモーダルを開く"
        >
          <form
            action={editMenu ? `/api/service-menus/${editMenu.id}` : '/api/service-menus'}
            method="post"
            className="space-y-4"
          >
            {editMenu && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-gray-700">
                メニュー名
                <Input
                  name="name"
                  required
                  defaultValue={editMenu?.name ?? ''}
                  placeholder="シャンプー&カット"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                カテゴリ
                <select
                  name="category"
                  defaultValue={editMenu?.category ?? ''}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="">未設定</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                価格
                <Input
                  type="number"
                  name="price"
                  required
                  defaultValue={editMenu?.price?.toString() ?? ''}
                  placeholder="8500"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                所要時間 (分)
                <Input
                  type="number"
                  name="duration"
                  required
                  defaultValue={editMenu?.duration?.toString() ?? ''}
                  placeholder="90"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                税率
                <Input
                  type="number"
                  name="tax_rate"
                  step="0.01"
                  defaultValue={editMenu?.tax_rate?.toString() ?? '0.1'}
                  placeholder="0.1"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                税込/税抜
                <select
                  name="tax_included"
                  defaultValue={editMenu?.tax_included ?? true ? 'true' : 'false'}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="true">税込</option>
                  <option value="false">税抜</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                有効/無効
                <select
                  name="is_active"
                  defaultValue={editMenu?.is_active ?? true ? 'true' : 'false'}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                表示順
                <Input
                  type="number"
                  name="display_order"
                  defaultValue={editMenu?.display_order?.toString() ?? '0'}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                説明
                <Input name="notes" defaultValue={editMenu?.notes ?? ''} />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{editMenu ? '更新する' : '登録する'}</Button>
              {editMenu && (
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
