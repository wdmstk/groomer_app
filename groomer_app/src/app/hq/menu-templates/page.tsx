import { Card } from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HqMenuTemplateRequestForm } from '@/components/hq/HqMenuTemplateRequestForm'
import { canRoleUseHqCapability, type MembershipRow } from '@/lib/auth/hq-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MembershipWithStoreRow = MembershipRow & {
  stores?: { name: string | null } | Array<{ name: string | null }> | null
}

function getStoreName(value: MembershipWithStoreRow['stores']) {
  if (!value) return '店舗名未設定'
  if (Array.isArray(value)) return value[0]?.name ?? '店舗名未設定'
  return value.name ?? '店舗名未設定'
}

export default async function HqMenuTemplatesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">テンプレ配信リクエスト</h1>
        <Card>
          <p className="text-sm text-gray-600">ログインが必要です。</p>
        </Card>
      </section>
    )
  }

  const { data: membershipsData } = await supabase
    .from('store_memberships')
    .select('store_id, role, stores(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const manageableMemberships = ((membershipsData ?? []) as MembershipWithStoreRow[]).filter((row) =>
    canRoleUseHqCapability(row.role, 'hq_view')
  )
  const ownerMemberships = manageableMemberships.filter((row) =>
    canRoleUseHqCapability(row.role, 'hq_template_request')
  )

  if (manageableMemberships.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">テンプレ配信リクエスト</h1>
        <Card>
          <p className="text-sm text-gray-600">owner/admin の所属店舗がありません。</p>
        </Card>
      </section>
    )
  }

  if (ownerMemberships.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">テンプレ配信リクエスト</h1>
        <Card>
          <p className="text-sm text-gray-600">この機能は owner のみ操作できます（admin は閲覧のみ）。</p>
        </Card>
      </section>
    )
  }

  const sourceStoreId = ownerMemberships[0].store_id
  const { data: menusData } = await supabase
    .from('service_menus')
    .select('id, name, category, price, duration')
    .eq('store_id', sourceStoreId)
    .order('display_order', { ascending: true })
    .limit(20)

  const storeOptions: Array<{ id: string; name: string; role: 'owner' | 'admin' }> = ownerMemberships.map((row) => ({
    id: row.store_id,
    name: getStoreName(row.stores),
    role: 'owner',
  }))
  const menus = menusData ?? []

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">テンプレ配信リクエスト</h1>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">管理可能店舗（owner）</h2>
        <div className="mt-2 space-y-1 text-sm text-gray-700">
          {storeOptions.map((store) => (
            <p key={store.id}>
              {store.name} ({store.role}) / {store.id}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">配信リクエスト作成</h2>
        <div className="mt-3">
          <HqMenuTemplateRequestForm stores={storeOptions} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">配信元サンプルメニュー（先頭20件）</h2>
        <p className="mt-1 text-xs text-gray-500">source_store_id: {sourceStoreId}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2.5 py-2">メニュー名</th>
                <th className="px-2.5 py-2">カテゴリ</th>
                <th className="px-2.5 py-2">価格</th>
                <th className="px-2.5 py-2">所要時間</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {menus.map((menu) => (
                <tr key={menu.id}>
                  <td className="px-2.5 py-2">{menu.name}</td>
                  <td className="px-2.5 py-2">{menu.category ?? '-'}</td>
                  <td className="px-2.5 py-2">{menu.price}</td>
                  <td className="px-2.5 py-2">{menu.duration} 分</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">次アクション</h2>
        <div className="mt-2 space-y-2 text-sm">
          <p>API契約は `docs/hq-menu-template-api-contract.md` を参照してください。</p>
        </div>
      </Card>
    </section>
  )
}
