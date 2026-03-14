import { Card } from '@/components/ui/Card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canRoleUseHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MembershipWithStoreRow = MembershipRow & {
  stores?: { name: string | null } | Array<{ name: string | null }> | null
}

type AppointmentRow = {
  store_id: string
  appointments_count: number | null
  completed_count: number | null
  canceled_count: number | null
  sales_amount: number | null
}

type AuditRow = {
  store_id: string
  action: string
}

type DeliveryRow = {
  source_store_id: string
  status: string
}

type PageProps = {
  searchParams?: Promise<{
    days?: string
  }>
}

function getStoreName(value: MembershipWithStoreRow['stores']) {
  if (!value) return '店舗名未設定'
  if (Array.isArray(value)) return value[0]?.name ?? '店舗名未設定'
  return value.name ?? '店舗名未設定'
}

function normalizeDays(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (parsed === 7 || parsed === 30 || parsed === 90) return parsed
  return 30
}

function getPastDaysDateKeys(days: number) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  const toDateKey = (date: Date) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  return { fromDateKey: toDateKey(start), toDateKey: toDateKey(end) }
}

export default async function HeadquartersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const windowDays = normalizeDays(params?.days)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">本部ダッシュボード</h1>
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

  const memberships = (membershipsData ?? []) as MembershipWithStoreRow[]
  const scopedMemberships = memberships.filter((row) => canRoleUseHqCapability(row.role, 'hq_view'))

  if (scopedMemberships.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">本部ダッシュボード</h1>
        <Card>
          <p className="text-sm text-gray-600">owner または admin の所属店舗がありません。</p>
        </Card>
      </section>
    )
  }

  const storeIds = scopedMemberships.map((row) => row.store_id)
  const storeNameById = new Map(scopedMemberships.map((row) => [row.store_id, getStoreName(row.stores)]))
  const { fromDateKey, toDateKey } = getPastDaysDateKeys(windowDays)

  const [{ data: appointmentsData }, { data: auditData }, { data: deliveriesData }] = await Promise.all([
    supabase
      .from('hq_store_daily_metrics_v1')
      .select('store_id, appointments_count, completed_count, canceled_count, sales_amount')
      .in('store_id', storeIds)
      .gte('metric_date_jst', fromDateKey)
      .lte('metric_date_jst', toDateKey),
    supabase
      .from('audit_logs')
      .select('store_id, action')
      .in('store_id', storeIds)
      .gte('created_at', new Date(`${fromDateKey}T00:00:00+09:00`).toISOString())
      .lt('created_at', new Date(`${toDateKey}T23:59:59+09:00`).toISOString()),
    supabase
      .from('hq_menu_template_deliveries')
      .select('source_store_id, status')
      .in('source_store_id', storeIds)
      .gte('created_at', new Date(`${fromDateKey}T00:00:00+09:00`).toISOString())
      .lt('created_at', new Date(`${toDateKey}T23:59:59+09:00`).toISOString()),
  ])

  const appointments = (appointmentsData ?? []) as AppointmentRow[]
  const audits = (auditData ?? []) as AuditRow[]
  const deliveries = (deliveriesData ?? []) as DeliveryRow[]

  const metricsByStore = new Map<
    string,
    {
      appointmentCount: number
      completedCount: number
      cancelCount: number
      salesAmount: number
      auditCount: number
    }
  >()

  const ensureMetrics = (storeId: string) => {
    const current = metricsByStore.get(storeId)
    if (current) return current
    const created = {
      appointmentCount: 0,
      completedCount: 0,
      cancelCount: 0,
      salesAmount: 0,
      auditCount: 0,
    }
    metricsByStore.set(storeId, created)
    return created
  }

  scopedMemberships.forEach((row) => {
    ensureMetrics(row.store_id)
  })

  appointments.forEach((row) => {
    const metrics = ensureMetrics(row.store_id)
    metrics.appointmentCount += row.appointments_count ?? 0
    metrics.completedCount += row.completed_count ?? 0
    metrics.cancelCount += row.canceled_count ?? 0
    metrics.salesAmount += row.sales_amount ?? 0
  })

  audits.forEach((row) => {
    const metrics = ensureMetrics(row.store_id)
    metrics.auditCount += 1
  })

  const rows = Array.from(metricsByStore.entries())
    .map(([storeId, metrics]) => {
      const completionRate =
        metrics.appointmentCount > 0
          ? Math.round((metrics.completedCount / metrics.appointmentCount) * 1000) / 10
          : 0
      const cancelRate =
        metrics.appointmentCount > 0
          ? Math.round((metrics.cancelCount / metrics.appointmentCount) * 1000) / 10
          : 0
      return {
        storeId,
        storeName: storeNameById.get(storeId) ?? '店舗名未設定',
        ...metrics,
        completionRate,
        cancelRate,
      }
    })
    .sort((a, b) => b.salesAmount - a.salesAmount)

  const totals = rows.reduce(
    (acc, row) => {
      acc.appointmentCount += row.appointmentCount
      acc.completedCount += row.completedCount
      acc.cancelCount += row.cancelCount
      acc.salesAmount += row.salesAmount
      acc.auditCount += row.auditCount
      return acc
    },
    { appointmentCount: 0, completedCount: 0, cancelCount: 0, salesAmount: 0, auditCount: 0 }
  )

  const topActions = Object.entries(
    audits.reduce(
      (acc, row) => {
        acc[row.action] = (acc[row.action] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const pendingDeliveries = deliveries.filter((row) => row.status === 'pending').length
  const appliedDeliveries = deliveries.filter((row) => row.status === 'applied').length
  const rejectedDeliveries = deliveries.filter((row) => row.status === 'rejected').length
  const totalSales = rows.reduce((sum, row) => sum + row.salesAmount, 0)

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">本部ダッシュボード</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[7, 30, 90].map((days) => (
            <Link
              key={days}
              href={`/hq?days=${days}`}
              className={`rounded border px-3 py-1 ${
                windowDays === days
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              直近{days}日
            </Link>
          ))}
          <span className="ml-1 text-xs text-gray-500">
            集計期間: {fromDateKey} 〜 {toDateKey}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">対象店舗数</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">予約件数（{windowDays}日）</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.appointmentCount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">売上（{windowDays}日）</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{Math.round(totals.salesAmount).toLocaleString()} 円</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">監査ログ件数（{windowDays}日）</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.auditCount.toLocaleString()}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">テンプレ配信（pending）</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{pendingDeliveries.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">テンプレ配信（applied）</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{appliedDeliveries.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">テンプレ配信（rejected）</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{rejectedDeliveries.toLocaleString()}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">店舗比較</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">店舗</th>
                <th className="px-2 py-2">予約件数</th>
                <th className="px-2 py-2">完了率</th>
                <th className="px-2 py-2">キャンセル率</th>
                <th className="px-2 py-2">売上</th>
                <th className="px-2 py-2">売上構成比</th>
                <th className="px-2 py-2">監査ログ</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {rows.map((row) => (
                <tr key={row.storeId}>
                  <td className="px-2 py-3 font-medium text-gray-900">{row.storeName}</td>
                  <td className="px-2 py-3">{row.appointmentCount.toLocaleString()} 件</td>
                  <td className="px-2 py-3">{row.completionRate.toFixed(1)}%</td>
                  <td className="px-2 py-3">{row.cancelRate.toFixed(1)}%</td>
                  <td className="px-2 py-3">{Math.round(row.salesAmount).toLocaleString()} 円</td>
                  <td className="px-2 py-3">
                    <div className="min-w-[120px]">
                      <div className="h-2 w-full rounded bg-slate-200">
                        <div
                          className="h-2 rounded bg-slate-700"
                          style={{
                            width: `${totalSales > 0 ? Math.max(2, Math.round((row.salesAmount / totalSales) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {totalSales > 0 ? ((row.salesAmount / totalSales) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-3">{row.auditCount.toLocaleString()} 件</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">権限監査サマリー</h2>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          {topActions.length === 0 ? (
            <p>監査ログはありません。</p>
          ) : (
            topActions.map(([action, count]) => (
              <p key={action}>
                {action}: {count.toLocaleString()} 件
              </p>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">クイックアクション</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/hq/manual" className="rounded border border-slate-300 px-3 py-2 text-slate-700">
            本部管理マニュアルへ
          </Link>
          <Link href="/hq/menu-templates" className="rounded border border-slate-300 px-3 py-2 text-slate-700">
            テンプレ配信リクエストへ
          </Link>
          <Link
            href="/hq/menu-template-deliveries"
            className="rounded border border-slate-300 px-3 py-2 text-slate-700"
          >
            配信承認一覧へ
          </Link>
        </div>
      </Card>
    </section>
  )
}
