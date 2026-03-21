import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  billingOperationTypeLabel,
  formatBillingDateTimeJst,
  formatBillingMonthJst,
  getBillingWebhookStatusClass,
} from '@/lib/billing/presentation'
import { billingPageFixtures } from '@/lib/e2e/billing-page-fixtures'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function BillingHistoryPage() {
  const guard = isPlaywrightE2E ? billingPageFixtures.guard : await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">決済履歴</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId } = guard
  const admin = isPlaywrightE2E ? null : createAdminSupabaseClient()
  const adminClient = admin as NonNullable<typeof admin>
  const statusHistory = isPlaywrightE2E
    ? billingPageFixtures.statusHistory
    : (
        await adminClient
          .from('billing_status_history')
          .select(
            'created_at, provider, from_status, to_status, source, reason, provider_subscription_id'
          )
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(100)
      ).data
  const webhookEvents = isPlaywrightE2E
    ? billingPageFixtures.webhookEvents
    : (
        await adminClient
          .from('billing_webhook_events')
          .select('id, created_at, provider, event_type, event_id, status, error_message')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(100)
      ).data
  const checkoutSessions = isPlaywrightE2E
    ? billingPageFixtures.checkoutSessions
    : (
        await adminClient
          .from('billing_checkout_sessions')
          .select('created_at, provider, idempotency_key, checkout_session_id, status, expires_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(100)
      ).data
  const usageMonthly = isPlaywrightE2E
    ? billingPageFixtures.usageMonthly
    : (
        await adminClient
          .from('notification_usage_billing_monthly')
          .select(
            'month_jst, counted_sent_messages, applied_limit, billable_messages, unit_price_jpy, amount_jpy, option_enabled, calculated_at'
          )
          .eq('store_id', storeId)
          .order('month_jst', { ascending: false })
          .limit(12)
      ).data
  const operations = isPlaywrightE2E
    ? billingPageFixtures.operations
    : (
        await adminClient
          .from('billing_operations')
          .select('created_at, provider, operation_type, amount_jpy, status, reason, result_message')
          .eq('store_id', storeId)
          .in('operation_type', [
            'setup_assistance_request',
            'setup_assistance_paid',
            'storage_addon_request',
            'storage_addon_paid',
            'notification_usage_billing_calculated',
          ])
          .order('created_at', { ascending: false })
          .limit(100)
      ).data

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">決済履歴</h1>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          決済管理へ戻る
        </Link>
      </div>

      <Card className="border border-amber-200 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-900">Webhook 障害時の確認順</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-950">
          <li>`Webhook受信履歴` で `status=failed` の行を探し、`provider`、`event_type`、`event_id`、`error` を確認する。</li>
          <li>`ステータス変更履歴` で同じ時刻帯の `source=webhook` を確認し、状態変更が反映されたかを確認する。</li>
          <li>失敗行の `webhook_event_id` を控え、サポート管理者へ再処理を依頼する（`POST /api/admin/billing/webhook-events/retry`）。</li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">通知従量課金（月次内訳）</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">対象月</th>
                <th className="px-2 py-2">送信通数</th>
                <th className="px-2 py-2">適用上限</th>
                <th className="px-2 py-2">課金通数</th>
                <th className="px-2 py-2">単価</th>
                <th className="px-2 py-2">金額</th>
                <th className="px-2 py-2">通知オプション</th>
                <th className="px-2 py-2">計算日時</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(usageMonthly ?? []).map((row, index) => (
                <tr key={`${row.month_jst}-${index}`} className="text-gray-700">
                  <td className="px-2 py-3">{formatBillingMonthJst(row.month_jst)}</td>
                  <td className="px-2 py-3">{row.counted_sent_messages.toLocaleString()}</td>
                  <td className="px-2 py-3">{row.applied_limit.toLocaleString()}</td>
                  <td className="px-2 py-3">{row.billable_messages.toLocaleString()}</td>
                  <td className="px-2 py-3">{row.unit_price_jpy.toLocaleString()} 円</td>
                  <td className="px-2 py-3 font-semibold">{row.amount_jpy.toLocaleString()} 円</td>
                  <td className="px-2 py-3">{row.option_enabled ? 'ON' : 'OFF'}</td>
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.calculated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">課金反映履歴（通知/容量/初期設定代行）</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日時</th>
                <th className="px-2 py-2">provider</th>
                <th className="px-2 py-2">反映種別</th>
                <th className="px-2 py-2">金額</th>
                <th className="px-2 py-2">status</th>
                <th className="px-2 py-2">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(operations ?? []).map((row, index) => (
                <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider}</td>
                  <td className="px-2 py-3">{billingOperationTypeLabel(row.operation_type)}</td>
                  <td className="px-2 py-3">{typeof row.amount_jpy === 'number' ? `${row.amount_jpy.toLocaleString()} 円` : '-'}</td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">{row.reason ?? row.result_message ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.created_at)}</td>
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
                <th className="px-2 py-2">webhook_event_id</th>
                <th className="px-2 py-2">error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(webhookEvents ?? []).map((row, index) => (
                <tr
                  key={`${row.created_at}-${index}`}
                  className={row.status === 'failed' ? 'bg-red-50 text-gray-700' : 'text-gray-700'}
                >
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider}</td>
                  <td className="px-2 py-3">{row.event_type}</td>
                  <td className="px-2 py-3">{row.event_id ?? '-'}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${getBillingWebhookStatusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs">{row.id}</td>
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
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.created_at)}</td>
                  <td className="px-2 py-3">{row.provider}</td>
                  <td className="px-2 py-3">{row.idempotency_key}</td>
                  <td className="px-2 py-3">{row.checkout_session_id ?? '-'}</td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">{formatBillingDateTimeJst(row.expires_at ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
