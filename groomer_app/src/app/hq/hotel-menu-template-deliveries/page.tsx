import { Card } from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HqHotelMenuTemplateApprovalActions } from '@/components/hq/HqHotelMenuTemplateApprovalActions'
import { canRoleUseHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DeliveryRow = {
  id: string
  source_store_id: string
  target_store_ids: string[]
  overwrite_scope: string
  status: string
  created_at: string
  applied_at: string | null
}

type SubscriptionRow = {
  store_id: string
  plan_code: string | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
}

function isHotelOptionEnabled(row: SubscriptionRow) {
  return (row.hotel_option_effective ?? row.hotel_option_enabled ?? false) === true
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function HqHotelMenuTemplateDeliveriesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信承認</h1>
        <Card>
          <p className="text-sm text-gray-600">ログインが必要です。</p>
        </Card>
      </section>
    )
  }

  const { data: membershipsData } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const candidateManageableStoreIds = memberships
    .filter((row) => canRoleUseHqCapability(row.role, 'hq_view'))
    .map((row) => row.store_id)
  const candidateApprovableStoreIds = memberships
    .filter((row) => canRoleUseHqCapability(row.role, 'hq_template_approve'))
    .map((row) => row.store_id)

  if (candidateManageableStoreIds.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信承認</h1>
        <Card>
          <p className="text-sm text-gray-600">owner/admin の所属店舗がありません。</p>
        </Card>
      </section>
    )
  }

  const { data: subscriptionData } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code, hotel_option_effective, hotel_option_enabled')
    .in('store_id', Array.from(new Set([...candidateManageableStoreIds, ...candidateApprovableStoreIds])))
  const eligibleStoreIdSet = new Set(
    ((subscriptionData ?? []) as SubscriptionRow[])
      .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code), 'pro') && isHotelOptionEnabled(row))
      .map((row) => row.store_id)
  )

  const manageableStoreIds = candidateManageableStoreIds.filter((id) => eligibleStoreIdSet.has(id))
  const approvableStoreIds = candidateApprovableStoreIds.filter((id) => eligibleStoreIdSet.has(id))

  if (manageableStoreIds.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信承認</h1>
        <Card>
          <p className="text-sm text-gray-600">Proプランかつホテルオプション有効の対象店舗がありません。</p>
        </Card>
      </section>
    )
  }

  const { data: deliveriesData, error } = await supabase
    .from('hq_hotel_menu_template_deliveries' as never)
    .select('id, source_store_id, target_store_ids, overwrite_scope, status, created_at, applied_at')
    .in('source_store_id', manageableStoreIds)
    .order('created_at', { ascending: false })
    .limit(100)

  const deliveries = (deliveriesData ?? []) as DeliveryRow[]

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">ホテルテンプレ配信承認</h1>
      </header>

      {error ? (
        <Card>
          <p className="text-sm text-red-600">{error.message}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">承認アクション</h2>
        {approvableStoreIds.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">admin は閲覧のみです。</p>
        ) : (
          <div className="mt-3">
            <HqHotelMenuTemplateApprovalActions
              deliveries={deliveries.map((delivery) => ({
                id: delivery.id,
                target_store_ids: delivery.target_store_ids,
                status: delivery.status,
              }))}
              manageableStoreIds={approvableStoreIds}
            />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">ホテルメニュー配信リクエスト一覧</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">delivery_id</th>
                <th className="px-2 py-2">source</th>
                <th className="px-2 py-2">targets</th>
                <th className="px-2 py-2">scope</th>
                <th className="px-2 py-2">status</th>
                <th className="px-2 py-2">作成</th>
                <th className="px-2 py-2">適用</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-gray-500">
                    配信リクエストはありません。
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-2 py-2 font-mono text-xs">{delivery.id}</td>
                    <td className="px-2 py-2 font-mono text-xs">{delivery.source_store_id}</td>
                    <td className="px-2 py-2 text-xs">{delivery.target_store_ids.join(', ')}</td>
                    <td className="px-2 py-2">{delivery.overwrite_scope}</td>
                    <td className="px-2 py-2">{delivery.status}</td>
                    <td className="px-2 py-2">{formatDateTime(delivery.created_at)}</td>
                    <td className="px-2 py-2">{formatDateTime(delivery.applied_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
