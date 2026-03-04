import { Card } from '@/components/ui/Card'
import { PaymentMethodButtons } from '@/components/billing/PaymentMethodButtons'
import { BillingOperationsPanel } from '@/components/billing/BillingOperationsPanel'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import Link from 'next/link'
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

function formatDateOnly(value: string | null) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function calculateTrialEnd(trialStartedAt: string | null, trialDays: number | null) {
  if (!trialStartedAt) return null
  const start = new Date(`${trialStartedAt}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(0, trialDays ?? 30))
  return end
}

function getStatusBadgeClass(status: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700'
  if (status === 'trialing') return 'bg-blue-100 text-blue-700'
  if (status === 'past_due') return 'bg-amber-100 text-amber-800'
  if (status === 'canceled') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

export default async function BillingPage() {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId } = guard
  const admin = createAdminSupabaseClient()
  const [{ data: storeSubscription }, { data: billingSubscriptions }, { data: operations }] = await Promise.all([
    admin
      .from('store_subscriptions')
      .select(
        'plan_code, billing_status, preferred_provider, trial_started_at, trial_days, grace_days, past_due_since, current_period_end, next_billing_date'
      )
      .eq('store_id', storeId)
      .maybeSingle(),
    admin
      .from('billing_subscriptions')
      .select('provider, status, provider_subscription_id, current_period_end, updated_at')
      .eq('store_id', storeId)
      .order('updated_at', { ascending: false }),
    admin
      .from('billing_operations')
      .select('created_at, provider, operation_type, amount_jpy, reason, status, result_message')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const trialEnd = calculateTrialEnd(
    storeSubscription?.trial_started_at ?? null,
    storeSubscription?.trial_days ?? 30
  )
  const today = new Date()
  const daysUntilTrialEnd =
    trialEnd === null ? null : Math.ceil((trialEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  const isTrialExpired = typeof daysUntilTrialEnd === 'number' && daysUntilTrialEnd <= 0
  const isPastDue = storeSubscription?.billing_status === 'past_due'
  const isCanceled = storeSubscription?.billing_status === 'canceled'
  const showUrgentAlert = isPastDue || isCanceled || isTrialExpired

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金（owner専用）</h1>
        <p className="text-sm text-gray-600">
          このページは現在アクティブな店舗の owner のみ利用できます。
        </p>
        <div>
          <Link href="/billing/history" className="text-sm font-semibold text-blue-700 hover:underline">
            課金履歴を見る
          </Link>
        </div>
      </div>

      {showUrgentAlert ? (
        <Card className="border border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800">要対応</h2>
          <p className="mt-2 text-sm text-red-700">
            {isPastDue
              ? '支払い遅延（past_due）状態です。決済情報を更新してください。'
              : isCanceled
                ? '契約がキャンセル状態です。利用継続には再課金が必要です。'
                : '試用期間が終了しています。継続利用には課金が必要です。'}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">現在の課金ステータス</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
          <p>プラン: {storeSubscription?.plan_code ?? 'free'}</p>
          <p>
            ステータス:{' '}
            <span
              className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                getStatusBadgeClass(storeSubscription?.billing_status ?? 'inactive')
              }`}
            >
              {storeSubscription?.billing_status ?? 'inactive'}
            </span>
          </p>
          <p>優先決済手段: {storeSubscription?.preferred_provider ?? '-'}</p>
          <p>試用開始日: {formatDateOnly(storeSubscription?.trial_started_at ?? null)}</p>
          <p>試用日数: {storeSubscription?.trial_days ?? 30} 日</p>
          <p>past_due猶予日数: {storeSubscription?.grace_days ?? 3} 日</p>
          <p>past_due開始日時: {formatDate(storeSubscription?.past_due_since ?? null)}</p>
          <p>
            試用終了予定日:{' '}
            <span className={isTrialExpired ? 'font-semibold text-red-700' : ''}>
              {trialEnd ? formatDate(trialEnd.toISOString()) : '-'}
            </span>
          </p>
          <p>
            利用停止まで:{' '}
            {typeof daysUntilTrialEnd === 'number'
              ? isTrialExpired
                ? '期限超過'
                : `${daysUntilTrialEnd} 日`
              : '-'}
          </p>
          <p>次回請求予定日: {storeSubscription?.next_billing_date ?? '-'}</p>
          <p>契約期間終了日: {formatDate(storeSubscription?.current_period_end ?? null)}</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">決済方法の選択</h2>
        <p className="mt-2 text-sm text-gray-600">
          月額1,000円の課金を開始します。Stripe（クレカ）かKOMOJU（キャリア決済）を選択してください。
        </p>
        <div className="mt-4">
          <PaymentMethodButtons />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">運用操作（切替 / 返金 / 解約）</h2>
        <p className="mt-2 text-sm text-gray-600">
          決済手段の切替と、返金依頼・解約指示を実行できます（操作履歴は保存されます）。
        </p>
        <div className="mt-4">
          <BillingOperationsPanel preferredProvider={storeSubscription?.preferred_provider ?? null} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">プロバイダ別ステータス</h2>
        {billingSubscriptions && billingSubscriptions.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">provider</th>
                  <th className="px-2 py-2">status</th>
                  <th className="px-2 py-2">provider_subscription_id</th>
                  <th className="px-2 py-2">current_period_end</th>
                  <th className="px-2 py-2">updated_at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billingSubscriptions.map((row) => (
                  <tr key={`${row.provider}-${row.provider_subscription_id ?? 'none'}`} className="text-gray-700">
                    <td className="px-2 py-3">{row.provider}</td>
                    <td className="px-2 py-3">{row.status}</td>
                    <td className="px-2 py-3">{row.provider_subscription_id ?? '-'}</td>
                    <td className="px-2 py-3">{formatDate(row.current_period_end ?? null)}</td>
                    <td className="px-2 py-3">{formatDate(row.updated_at ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">まだ課金履歴がありません。</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">最近のオペレーション履歴</h2>
        {operations && operations.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">日時</th>
                  <th className="px-2 py-2">provider</th>
                  <th className="px-2 py-2">operation</th>
                  <th className="px-2 py-2">amount</th>
                  <th className="px-2 py-2">status</th>
                  <th className="px-2 py-2">reason/result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {operations.map((row, index) => (
                  <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                    <td className="px-2 py-3">{formatDate(row.created_at)}</td>
                    <td className="px-2 py-3">{row.provider}</td>
                    <td className="px-2 py-3">{row.operation_type}</td>
                    <td className="px-2 py-3">{row.amount_jpy ?? '-'}</td>
                    <td className="px-2 py-3">{row.status}</td>
                    <td className="px-2 py-3">{row.reason || row.result_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">まだ操作履歴がありません。</p>
        )}
      </Card>
    </section>
  )
}
