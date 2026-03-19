import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import {
  formatServiceMenuActive,
  formatServiceMenuCategory,
  formatServiceMenuInstantBookable,
  formatServiceMenuNotes,
  formatServiceMenuTaxIncluded,
  formatServiceMenuTaxRate,
} from '@/lib/service-menus/presentation'
import { serviceMenusPageFixtures } from '@/lib/e2e/service-menus-page-fixtures'
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

const categoryOptions = ['トリミング', 'お手入れ', 'セット', 'オプション']
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type ServiceMenuRow = {
  id: string
  name: string
  category: string | null
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_active: boolean | null
  is_instant_bookable: boolean | null
  display_order: number | null
  notes: string | null
}

type AppointmentDurationLearningRow = {
  menu: string | null
  duration: number | null
}

export default async function ServiceMenusPage({ searchParams }: ServiceMenusPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/service-menus?tab=${activeTab}`
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: serviceMenusPageFixtures.storeId }
    : await createStoreScopedClient()

  const menus = isPlaywrightE2E
    ? serviceMenusPageFixtures.menus
    : (
        await supabase
          .from('service_menus')
          .select(
            'id, name, category, price, duration, tax_rate, tax_included, is_active, is_instant_bookable, display_order, notes'
          )
          .eq('store_id', storeId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false })
      ).data

  const editMenu =
    !editId
      ? null
      : isPlaywrightE2E
        ? serviceMenusPageFixtures.menus.find((menu) => menu.id === editId) ?? null
        : (
            await supabase
              .from('service_menus')
              .select(
                'id, name, category, price, duration, tax_rate, tax_included, is_active, is_instant_bookable, display_order, notes'
              )
              .eq('id', editId)
              .eq('store_id', storeId)
              .single()
          ).data

  const menuList = (menus ?? []) as ServiceMenuRow[]
  const learningWindowDays = 60
  const now = new Date()
  const learningStartIso = new Date(now.getTime() - learningWindowDays * 24 * 60 * 60 * 1000).toISOString()
  const completedAppointments = isPlaywrightE2E
    ? serviceMenusPageFixtures.completedAppointments
    : (
        await supabase
          .from('appointments')
          .select('menu, duration')
          .eq('store_id', storeId)
          .in('status', ['完了', '来店済'])
          .gte('start_time', learningStartIso)
          .not('duration', 'is', null)
      ).data

  const durationLearningRows = (completedAppointments ?? []) as AppointmentDurationLearningRow[]
  const actualDurationsByMenu = new Map<string, number[]>()
  durationLearningRows.forEach((row) => {
    const menuName = row.menu?.trim()
    if (!menuName || !row.duration || row.duration <= 0) return
    const list = actualDurationsByMenu.get(menuName) ?? []
    list.push(row.duration)
    actualDurationsByMenu.set(menuName, list)
  })
  const durationSuggestionByMenuId = new Map<
    string,
    { recommendedDuration: number; currentDuration: number; sampleCount: number; delta: number }
  >()
  menuList.forEach((menu) => {
    const samples = actualDurationsByMenu.get(menu.name) ?? []
    if (samples.length < 5) return
    const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)
    const delta = avg - menu.duration
    if (Math.abs(delta) < 10) return
    durationSuggestionByMenuId.set(menu.id, {
      recommendedDuration: Math.max(1, avg),
      currentDuration: menu.duration,
      sampleCount: samples.length,
      delta,
    })
  })
  const durationSuggestionRows = menuList
    .map((menu) => {
      const suggestion = durationSuggestionByMenuId.get(menu.id)
      if (!suggestion) return null
      return { menu, suggestion }
    })
    .filter((row): row is { menu: ServiceMenuRow; suggestion: { recommendedDuration: number; currentDuration: number; sampleCount: number; delta: number } } => Boolean(row))
    .sort((a, b) => Math.abs(b.suggestion.delta) - Math.abs(a.suggestion.delta))

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">施術メニュー管理</h1>
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
        <div className="mb-4 flex items-center justify-between rounded border border-violet-200 bg-violet-50 p-3">
          <div>
            <p className="text-xs text-violet-700">所要時間の自己学習補正（直近{learningWindowDays}日）</p>
            <p className="text-sm font-semibold text-violet-900">
              推奨更新候補 {durationSuggestionRows.length} 件
            </p>
          </div>
          <Link href="/appointments?tab=list&modal=create" className="rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white">
            予約作成へ
          </Link>
        </div>
        {durationSuggestionRows.length > 0 ? (
          <div className="mb-4 space-y-2">
            {durationSuggestionRows.slice(0, 5).map(({ menu, suggestion }) => (
              <div key={menu.id} className="flex flex-col gap-2 rounded border border-violet-200 bg-violet-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{menu.name}</p>
                  <p className="text-gray-700">
                    現在 {suggestion.currentDuration} 分 → 推奨 {suggestion.recommendedDuration} 分
                    （差分 {suggestion.delta > 0 ? '+' : ''}{suggestion.delta} 分 / 実績 {suggestion.sampleCount} 件）
                  </p>
                </div>
                <Link href={`/service-menus?tab=list&edit=${menu.id}`} className="rounded border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700">
                  このメニューを編集
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-500">推奨更新候補はありません（実績5件以上かつ差分10分以上で表示）。</p>
        )}
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
            <div className="space-y-3 md:hidden" data-testid="service-menus-list-mobile">
              {menuList.map((menu) => (
                <article
                  key={menu.id}
                  className="rounded border p-3 text-sm text-gray-700"
                  data-testid={`service-menu-row-${menu.id}`}
                >
                  <p className="font-semibold text-gray-900">{menu.name}</p>
                  <p>カテゴリ: {formatServiceMenuCategory(menu.category)}</p>
                  <p>価格: {menu.price.toLocaleString()} 円</p>
                  <p>時間: {menu.duration} 分</p>
                  <p>税率: {formatServiceMenuTaxRate(menu.tax_rate)}</p>
                  <p>税込: {formatServiceMenuTaxIncluded(menu.tax_included)}</p>
                  <p>有効: {formatServiceMenuActive(menu.is_active)}</p>
                  <p>即時確定対象: {formatServiceMenuInstantBookable(menu.is_instant_bookable)}</p>
                  <p>表示順: {menu.display_order ?? 0}</p>
                  <p>備考: {formatServiceMenuNotes(menu.notes)}</p>
                  {durationSuggestionByMenuId.has(menu.id) ? (
                    <p className="mt-1 inline-flex rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      推奨 {durationSuggestionByMenuId.get(menu.id)?.recommendedDuration} 分
                    </p>
                  ) : null}
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
              <table className="min-w-full text-sm text-left" data-testid="service-menus-list">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="py-2 px-2">メニュー</th>
                    <th className="py-2 px-2">カテゴリ</th>
                    <th className="py-2 px-2">価格</th>
                    <th className="py-2 px-2">時間</th>
                    <th className="py-2 px-2">推奨所要時間</th>
                    <th className="py-2 px-2">税率</th>
                    <th className="py-2 px-2">税込</th>
                    <th className="py-2 px-2">有効</th>
                    <th className="py-2 px-2">即時確定対象</th>
                    <th className="py-2 px-2">表示順</th>
                    <th className="py-2 px-2">備考</th>
                    <th className="py-2 px-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {menuList.map((menu) => (
                    <tr
                      key={menu.id}
                      className="text-gray-700"
                      data-testid={`service-menu-row-${menu.id}`}
                    >
                      <td className="py-3 px-2 font-medium text-gray-900">{menu.name}</td>
                      <td className="py-3 px-2">{formatServiceMenuCategory(menu.category)}</td>
                      <td className="py-3 px-2">{menu.price.toLocaleString()} 円</td>
                      <td className="py-3 px-2">{menu.duration} 分</td>
                      <td className="py-3 px-2">
                        {durationSuggestionByMenuId.has(menu.id) ? (
                          <span className="rounded bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                            推奨 {durationSuggestionByMenuId.get(menu.id)?.recommendedDuration} 分
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2">{formatServiceMenuTaxRate(menu.tax_rate)}</td>
                      <td className="py-3 px-2">{formatServiceMenuTaxIncluded(menu.tax_included)}</td>
                      <td className="py-3 px-2">{formatServiceMenuActive(menu.is_active)}</td>
                      <td className="py-3 px-2">{formatServiceMenuInstantBookable(menu.is_instant_bookable)}</td>
                      <td className="py-3 px-2">{menu.display_order ?? 0}</td>
                      <td className="py-3 px-2">{formatServiceMenuNotes(menu.notes)}</td>
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
                公開予約の即時確定対象
                <select
                  name="is_instant_bookable"
                  defaultValue={editMenu?.is_instant_bookable ?? false ? 'true' : 'false'}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="false">対象外</option>
                  <option value="true">対象</option>
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
