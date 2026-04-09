import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { FailedWebhookEventsPanel } from '@/components/dev/FailedWebhookEventsPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AlertRow = {
  store_id: string
  billing_status: string
  trial_started_at: string | null
  trial_days: number | null
  past_due_since: string | null
  stores?: { name: string | null } | { name: string | null }[] | null
}

function resolveStoreName(stores: AlertRow['stores']) {
  if (!stores) return '店舗名未設定'
  if (Array.isArray(stores)) return stores[0]?.name ?? '店舗名未設定'
  return stores.name ?? '店舗名未設定'
}

function trialDaysLeft(startRaw: string | null, daysRaw: number | null) {
  if (!startRaw) return null
  const start = new Date(`${startRaw}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(0, daysRaw ?? 30))
  const diffMs = end.getTime() - new Date().getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

export default async function BillingAlertsPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">課金アラート</h1>
        <Card>
          <p className="text-sm text-red-700">このページはサポート管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  const admin = createAdminSupabaseClient()
  const [{ data }, { data: failedWebhookEvents }] = await Promise.all([
    admin
      .from('store_subscriptions')
      .select('store_id, billing_status, trial_started_at, trial_days, past_due_since, stores(name)')
      .in('billing_status', ['trialing', 'past_due', 'canceled'])
      .order('updated_at', { ascending: false }),
    admin
      .from('billing_webhook_events')
      .select('id, created_at, store_id, provider, event_type, event_id, status, error_message, stores(name)')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const rows = (data ?? []) as AlertRow[]
  const important = rows
    .map((row) => ({ ...row, daysLeft: trialDaysLeft(row.trial_started_at, row.trial_days) }))
    .filter((row) => row.billing_status !== 'trialing' || (row.daysLeft ?? 9999) <= 7)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">課金アラート</h1>
        </div>
        <Link
          href="/dev"
          className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          一覧へ戻る
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm text-left">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2.5 py-2">店舗</th>
                <th className="px-2.5 py-2">status</th>
                <th className="px-2.5 py-2">試用残日数</th>
                <th className="px-2.5 py-2">past_due_since</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {important.map((row) => (
                <tr key={row.store_id} className="text-gray-700">
                  <td className="px-2.5 py-2">{resolveStoreName(row.stores)}</td>
                  <td className="px-2.5 py-2">{row.billing_status}</td>
                  <td className="px-2.5 py-2">{row.daysLeft ?? '-'}</td>
                  <td className="px-2.5 py-2">{row.past_due_since ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {failedWebhookEvents && failedWebhookEvents.length > 0 ? (
        <FailedWebhookEventsPanel
          events={
            failedWebhookEvents as {
              id: string
              created_at: string
              store_id: string | null
              provider: 'stripe' | 'komoju'
              event_type: string
              event_id: string | null
              status: 'failed'
              error_message: string | null
              stores?: { name: string | null } | { name: string | null }[] | null
            }[]
          }
        />
      ) : (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">Webhook失敗イベント再処理</h2>
          <p className="mt-2 text-sm text-gray-600">再処理対象の失敗イベントはありません。</p>
        </Card>
      )}
    </section>
  )
}
