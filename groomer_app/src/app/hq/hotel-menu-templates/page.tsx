import { Card } from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HqHotelMenuTemplateRequestForm } from '@/components/hq/HqHotelMenuTemplateRequestForm'
import { canRoleUseHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MembershipWithStoreRow = MembershipRow & {
  stores?: { name: string | null } | Array<{ name: string | null }> | null
}

type SubscriptionRow = {
  store_id: string
  plan_code: string | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
}

function getStoreName(value: MembershipWithStoreRow['stores']) {
  if (!value) return '店舗名未設定'
  if (Array.isArray(value)) return value[0]?.name ?? '店舗名未設定'
  return value.name ?? '店舗名未設定'
}

function isHotelOptionEnabled(row: SubscriptionRow) {
  return (row.hotel_option_effective ?? row.hotel_option_enabled ?? false) === true
}

export default async function HqHotelMenuTemplatesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信リクエスト</h1>
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

  if (ownerMemberships.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信リクエスト</h1>
        <Card>
          <p className="text-sm text-gray-600">この機能は owner のみ操作できます（admin は閲覧のみ）。</p>
        </Card>
      </section>
    )
  }

  const ownerStoreIds = ownerMemberships.map((row) => row.store_id)
  const { data: subscriptionData } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code, hotel_option_effective, hotel_option_enabled')
    .in('store_id', ownerStoreIds)

  const eligibleStoreIdSet = new Set(
    ((subscriptionData ?? []) as SubscriptionRow[])
      .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code), 'pro') && isHotelOptionEnabled(row))
      .map((row) => row.store_id)
  )

  const eligibleOwnerMemberships = ownerMemberships.filter((row) => eligibleStoreIdSet.has(row.store_id))

  if (eligibleOwnerMemberships.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信リクエスト</h1>
        <Card>
          <p className="text-sm text-gray-600">
            Proプランかつホテルオプション有効な owner 所属店舗がありません。
          </p>
        </Card>
      </section>
    )
  }

  const sourceStoreId = eligibleOwnerMemberships[0].store_id
  const { data: menusData } = await supabase
    .from('hotel_menu_items')
    .select(
      'id, name, item_type, price, billing_unit, default_quantity, duration_minutes, counts_toward_capacity, tax_rate, tax_included, is_active'
    )
    .eq('store_id', sourceStoreId)
    .order('display_order', { ascending: true })
    .limit(20)

  const storeOptions: Array<{ id: string; name: string; role: 'owner' | 'admin' }> =
    eligibleOwnerMemberships.map((row) => ({
      id: row.store_id,
      name: getStoreName(row.stores),
      role: 'owner',
    }))
  const menus = menusData ?? []

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信リクエスト</h1>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">管理可能店舗（owner / Pro / ホテルオプション有効）</h2>
        <div className="mt-2 space-y-1 text-sm text-gray-700">
          {storeOptions.map((store) => (
            <p key={store.id}>
              {store.name} ({store.role}) / {store.id}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">ホテルメニュー配信リクエスト作成</h2>
        <div className="mt-3">
          <HqHotelMenuTemplateRequestForm stores={storeOptions} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">配信元サンプルホテルメニュー（先頭20件）</h2>
        <p className="mt-1 text-xs text-gray-500">source_store_id: {sourceStoreId}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">項目名</th>
                <th className="px-2 py-2">種別</th>
                <th className="px-2 py-2">単位</th>
                <th className="px-2 py-2">価格</th>
                <th className="px-2 py-2">所要時間</th>
                <th className="px-2 py-2">標準数量</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {menus.map((menu) => (
                <tr key={menu.id}>
                  <td className="px-2 py-2">{menu.name}</td>
                  <td className="px-2 py-2">{menu.item_type}</td>
                  <td className="px-2 py-2">{menu.billing_unit}</td>
                  <td className="px-2 py-2">{menu.price}</td>
                  <td className="px-2 py-2">{menu.duration_minutes ?? '-'} 分</td>
                  <td className="px-2 py-2">{menu.default_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
