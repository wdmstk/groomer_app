import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatDate(value: string | null) {
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

export default async function BillingHistoryPage() {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">課金履歴</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId } = guard
  const admin = createAdminSupabaseClient()
  const [{ data: statusHistory }, { data: webhookEvents }, { data: checkoutSessions }] =
    await Promise.all([
      admin
        .from('billing_status_history')
        .select(
          'created_at, provider, from_status, to_status, source, reason, provider_subscription_id'
        )
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('billing_webhook_events')
        .select('created_at, provider, event_type, event_id, status, error_message')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('billing_checkout_sessions')
        .select('created_at, provider, idempotency_key, checkout_session_id, status, expires_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">課金履歴</h1>
          <p className="text-sm text-gray-600">決済ステータス変更・Webhook受信・Checkout起動履歴を確認できます。</p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          課金ページへ戻る
        </Link>
      </div>

      <Card className="border border-amber-200 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-900">Webhook 障害時の確認順</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-950">
          <li>`Webhook受信履歴` で `status=error` の行を探し、`provider`、`event_type`、`event_id`、`error` を確認する。</li>
          <li>`ステータス変更履歴` で同じ時刻帯の `source=webhook` を確認し、状態変更が反映されたかを確認する。</li>
          <li>provider と created_at を控え、必要に応じて管理者へ連絡する。</li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">ステータス変更履歴</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">provider</th>
                <th className="px-2 py-2">from</th>
                <th className="px-2 py-2">to</th>
                <th className="px-2 py-2">source</th>
                <th className="px-2 py-2">reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(statusHistory ?? []).map((row, index) => (
                <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                  <td className="px-2 py-3">{formatDate(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider ?? '-'}</td>
                  <td className="px-2 py-3">{row.from_status ?? '-'}</td>
                  <td className="px-2 py-3">{row.to_status}</td>
                  <td className="px-2 py-3">{row.source}</td>
                  <td className="px-2 py-3">{row.reason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">Webhook受信履歴</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">provider</th>
                <th className="px-2 py-2">event_type</th>
                <th className="px-2 py-2">event_id</th>
                <th className="px-2 py-2">status</th>
                <th className="px-2 py-2">error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(webhookEvents ?? []).map((row, index) => (
                <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                  <td className="px-2 py-3">{formatDate(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider}</td>
                  <td className="px-2 py-3">{row.event_type}</td>
                  <td className="px-2 py-3">{row.event_id ?? '-'}</td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">{row.error_message ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">Checkout起動履歴（重複防止ログ）</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">provider</th>
                <th className="px-2 py-2">idempotency_key</th>
                <th className="px-2 py-2">checkout_session_id</th>
                <th className="px-2 py-2">status</th>
                <th className="px-2 py-2">expires_at</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(checkoutSessions ?? []).map((row, index) => (
                <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                  <td className="px-2 py-3">{formatDate(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider}</td>
                  <td className="px-2 py-3">{row.idempotency_key}</td>
                  <td className="px-2 py-3">{row.checkout_session_id ?? '-'}</td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">{formatDate(row.expires_at ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
