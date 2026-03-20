import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import Link from 'next/link'
import {
  billingOperationTypeLabel,
  formatBillingDateOnlyJst,
  formatBillingDateTimeJst,
  getBillingStatusBadgeClass,
} from '@/lib/billing/presentation'
import { billingPageFixtures } from '@/lib/e2e/billing-page-fixtures'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { canPurchaseOptionsByPlan, normalizePlanCode, optionLabel, planLabel } from '@/lib/subscription-plan'
import { countActiveOwnerStores } from '@/lib/billing/db'
import {
  amountForOptions,
  amountForPlan,
  amountForPlanWithStoreCount,
  amountForStorageAddonUnits,
  parseAiPlanCode,
  parseBillingCycle,
  STORAGE_ADDON_UNIT_GB,
} from '@/lib/billing/pricing'

const PaymentMethodButtons = nextDynamic(
  () => import('@/components/billing/PaymentMethodButtons').then((mod) => mod.PaymentMethodButtons)
)

const BillingOperationsPanel = nextDynamic(
  () => import('@/components/billing/BillingOperationsPanel').then((mod) => mod.BillingOperationsPanel),
  {
    loading: () => <p className="text-sm text-gray-500">課金操作を読み込み中...</p>,
  }
)

const SetupAssistanceCheckoutButton = nextDynamic(
  () => import('@/components/billing/SetupAssistanceCheckoutButton').then((mod) => mod.SetupAssistanceCheckoutButton)
)

const StorageAddonCheckoutPanel = nextDynamic(
  () => import('@/components/billing/StorageAddonCheckoutPanel').then((mod) => mod.StorageAddonCheckoutPanel)
)

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

function calculateTrialEnd(trialStartedAt: string | null, trialDays: number | null) {
  if (!trialStartedAt) return null
  const start = new Date(`${trialStartedAt}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(0, trialDays ?? 30))
  return end
}

type BillingPageProps = {
  searchParams?: Promise<{
    message?: string
    error?: string
  }>
}

async function fetchStoreSubscriptionWithAiFallback(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
  const withAi = await admin
    .from('store_subscriptions')
    .select(
      'plan_code, hotel_option_enabled, notification_option_enabled, ai_plan_code, billing_cycle, billing_status, preferred_provider, amount_jpy, trial_started_at, trial_days, grace_days, past_due_since, current_period_end, next_billing_date'
    )
    .eq('store_id', storeId)
    .maybeSingle()

  if (!withAi.error) {
    return withAi.data
  }

  const fallback = await admin
    .from('store_subscriptions')
    .select(
      'plan_code, hotel_option_enabled, notification_option_enabled, billing_cycle, billing_status, preferred_provider, amount_jpy, trial_started_at, trial_days, grace_days, past_due_since, current_period_end, next_billing_date'
    )
    .eq('store_id', storeId)
    .maybeSingle()
  return fallback.data
}

function aiPlanLabel(value: string) {
  if (value === 'assist') return 'AI Assist'
  if (value === 'pro') return 'AI Pro'
  if (value === 'pro_plus') return 'AI Pro+'
  return '未契約'
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams
  const guard = isPlaywrightE2E ? billingPageFixtures.guard : await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">決済管理</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId, user } = guard
  const admin = isPlaywrightE2E ? null : createAdminSupabaseClient()
  const ownerActiveStoreCount = isPlaywrightE2E
    ? billingPageFixtures.ownerActiveStoreCount
    : await countActiveOwnerStores(user.id)
  const storeSubscription = isPlaywrightE2E
    ? billingPageFixtures.storeSubscription
    : await fetchStoreSubscriptionWithAiFallback(admin, storeId)
  const billingSubscriptions = isPlaywrightE2E
    ? billingPageFixtures.billingSubscriptions
    : (
        await admin
          .from('billing_subscriptions')
          .select('provider, status, provider_subscription_id, subscription_scope, storage_addon_units, current_period_end, updated_at')
          .eq('store_id', storeId)
          .order('updated_at', { ascending: false })
      ).data
  const operations = isPlaywrightE2E
    ? billingPageFixtures.operations
    : (
        await admin
          .from('billing_operations')
          .select('created_at, provider, operation_type, amount_jpy, reason, status, result_message')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(20)
      ).data
  const storagePolicy = isPlaywrightE2E
    ? billingPageFixtures.storagePolicy
    : (
        await admin
          .from('store_storage_policies')
          .select('extra_capacity_gb')
          .eq('store_id', storeId)
          .maybeSingle()
      ).data

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
  const normalizedPlanCode = normalizePlanCode(storeSubscription?.plan_code ?? 'light')
  const billingCycle = parseBillingCycle(storeSubscription?.billing_cycle)
  const canPurchaseOptions = canPurchaseOptionsByPlan(normalizedPlanCode)
  const hotelOptionEnabled = storeSubscription?.hotel_option_enabled === true
  const notificationOptionEnabled = storeSubscription?.notification_option_enabled === true
  const aiPlanCode = parseAiPlanCode(
    (storeSubscription as (typeof storeSubscription & { ai_plan_code?: string | null }) | null)?.ai_plan_code ?? 'none'
  )
  const baseAmountJpy = amountForPlan(normalizedPlanCode, billingCycle)
  const discountedBaseAmountJpy = amountForPlanWithStoreCount(
    normalizedPlanCode,
    billingCycle,
    ownerActiveStoreCount
  )
  const baseDiscountJpy = Math.max(0, baseAmountJpy - discountedBaseAmountJpy)
  const optionAmountJpy = amountForOptions(normalizedPlanCode, billingCycle, {
    hotelOptionEnabled,
    notificationOptionEnabled,
    aiPlanCode,
  })
  const coreBilledAmountJpy = discountedBaseAmountJpy + optionAmountJpy
  const storageSubscription = (billingSubscriptions ?? []).find(
    (row) => row.subscription_scope === 'storage_addon'
  )
  const coreSubscription = (billingSubscriptions ?? []).find(
    (row) => row.subscription_scope === 'core'
  )
  const storageAddonUnits = Math.max(
    0,
    Math.floor(storageSubscription?.storage_addon_units ?? (storagePolicy?.extra_capacity_gb ?? 0) / STORAGE_ADDON_UNIT_GB)
  )
  const extraCapacityGb = storageAddonUnits * STORAGE_ADDON_UNIT_GB
  const storageAddonAmountJpy = amountForStorageAddonUnits(storageAddonUnits)
  const billingCycleLabel = billingCycle === 'yearly' ? '年払い' : '月払い'
  const storageCycleLabel = '月額'

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">決済管理（owner専用）</h1>
        <div>
          <Link href="/billing?tab=history" className="text-sm font-semibold text-blue-700 hover:underline">
            決済履歴を見る
          </Link>
        </div>
      </div>
      {params?.message ? (
        <Card className="border border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-700">{params.message}</p>
        </Card>
      ) : null}
      {params?.error ? (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{params.error}</p>
        </Card>
      ) : null}

      {showUrgentAlert ? (
        <Card className="border border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800">要対応</h2>
          <p className="mt-1.5 text-sm text-red-700">
            {isPastDue
              ? '支払い遅延（past_due）状態です。決済情報を更新してください。'
              : isCanceled
                ? '契約がキャンセル状態です。利用継続には再課金が必要です。'
                : '試用期間が終了しています。継続利用には課金が必要です。'}
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Overview</p>
          <h2 className="text-lg font-semibold text-gray-900">契約サマリー</h2>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-gray-700 md:grid-cols-2">
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">プラン</span>
              <span className="font-medium text-gray-900">{planLabel(normalizedPlanCode)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">請求周期</span>
              <span className="font-medium text-gray-900">{billingCycleLabel}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">AIプラン</span>
              <span className="font-medium text-gray-900">{aiPlanLabel(aiPlanCode)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">基本+オプション請求額</span>
              <span className="font-medium text-gray-900">
                {typeof storeSubscription?.amount_jpy === 'number' ? `${storeSubscription.amount_jpy} 円` : `${coreBilledAmountJpy} 円`}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">ステータス</span>
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  getBillingStatusBadgeClass(storeSubscription?.billing_status ?? 'inactive')
                }`}
              >
                {storeSubscription?.billing_status ?? 'inactive'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">優先決済手段</span>
              <span className="font-medium text-gray-900">{storeSubscription?.preferred_provider ?? '-'}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">次回請求予定日</span>
              <span className="font-medium text-gray-900">{storeSubscription?.next_billing_date ?? '-'}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">基本+オプション契約終了日</span>
              <span className="font-medium text-gray-900">
                {formatBillingDateTimeJst(
                  storeSubscription?.current_period_end ?? coreSubscription?.current_period_end ?? null
                )}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">利用停止まで</span>
              <span className="font-medium text-gray-900">
                {typeof daysUntilTrialEnd === 'number'
                  ? isTrialExpired
                    ? '期限超過'
                    : `${daysUntilTrialEnd} 日`
                  : '-'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">試用開始日</span>
              <span className="font-medium text-gray-900">
                {formatBillingDateOnlyJst(storeSubscription?.trial_started_at ?? null)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">試用日数</span>
              <span className="font-medium text-gray-900">{storeSubscription?.trial_days ?? 30} 日</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">試用終了予定日</span>
              <span className={isTrialExpired ? 'font-medium text-red-700' : 'font-medium text-gray-900'}>
                {trialEnd ? formatBillingDateTimeJst(trialEnd.toISOString()) : '-'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 pb-1.5">
              <span className="text-gray-500">past_due猶予日数</span>
              <span className="font-medium text-gray-900">{storeSubscription?.grace_days ?? 3} 日</span>
            </p>
            <p className="flex items-center justify-between gap-4 md:col-span-2">
              <span className="text-gray-500">past_due開始日時</span>
              <span className="font-medium text-gray-900">
                {formatBillingDateTimeJst(storeSubscription?.past_due_since ?? null)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 md:col-span-2">
              <span className="text-gray-500">容量追加 次回請求予定日</span>
              <span className="font-medium text-gray-900">
                {formatBillingDateTimeJst(storageSubscription?.current_period_end ?? null)}
              </span>
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Breakdown</p>
          <h2 className="text-lg font-semibold text-gray-900">料金内訳</h2>
          <div className="mt-3 space-y-2.5 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
              <span>基本料金 定価</span>
              <span className="font-medium">{baseAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
              <span>複数店舗割引</span>
              <span className="font-medium">-{baseDiscountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
              <span>オプション料金</span>
              <span className="font-medium">{optionAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
              <span>追加容量料金（{storageCycleLabel}）</span>
              <span className="font-medium">{storageAddonAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-1 text-xs text-gray-500">
              <span>現在の追加容量</span>
              <span>{extraCapacityGb} GB</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-3 py-2 text-base font-semibold text-gray-900">
              <span>基本+オプション請求額</span>
              <span>{coreBilledAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            容量追加は基本契約とは別の月額継続契約として扱います。
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Add-ons</p>
        <h2 className="text-lg font-semibold text-gray-900">オプション契約</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 xl:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900">{optionLabel('hotel')}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${hotelOptionEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {hotelOptionEnabled ? '有効' : '未契約'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">対象: スタンダード / プロ</p>
            <form action="/api/billing/options" method="post" className="mt-2">
              <input type="hidden" name="option" value="hotel" />
              <input type="hidden" name="hotel_option_enabled" value={hotelOptionEnabled ? 'false' : 'true'} />
              <button
                type="submit"
                disabled={!canPurchaseOptions}
                className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hotelOptionEnabled ? '無効化する' : '有効化する'}
              </button>
            </form>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900">{optionLabel('notification')}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${notificationOptionEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {notificationOptionEnabled ? '有効' : '未契約'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">対象: スタンダード / プロ</p>
            <form action="/api/billing/options" method="post" className="mt-2">
              <input type="hidden" name="option" value="notification" />
              <input
                type="hidden"
                name="notification_option_enabled"
                value={notificationOptionEnabled ? 'false' : 'true'}
              />
              <button
                type="submit"
                disabled={!canPurchaseOptions}
                className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {notificationOptionEnabled ? '無効化する' : '有効化する'}
              </button>
            </form>
          </div>
          <div className="rounded-lg border p-3 xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900">AIプラン</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${aiPlanCode === 'none' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                {aiPlanLabel(aiPlanCode)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">プラン変更は即時または次回請求タイミングで反映されます。</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="none" />
                <button
                  type="submit"
                  className="w-full rounded border px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  無効化
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="assist" />
                <button
                  type="submit"
                  className="w-full rounded border px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  Assist (1,280円)
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="pro" />
                <button
                  type="submit"
                  className="w-full rounded border px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  Pro (1,980円)
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="pro_plus" />
                <button
                  type="submit"
                  className="w-full rounded border px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  Pro+ (2,480円)
                </button>
              </form>
            </div>
          </div>
          {!canPurchaseOptions ? (
            <p className="text-xs text-amber-700">
              ライトプランではオプション契約はできません。スタンダード以上へ変更してください。
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Storage</p>
          <h2 className="text-lg font-semibold text-gray-900">容量追加の決済</h2>
          <p className="mt-1.5 text-sm text-gray-700">
            容量追加分だけを決済します。現在の追加容量は {extraCapacityGb}GB です。
          </p>
          <div className="mt-4">
            <StorageAddonCheckoutPanel />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            使用量や超過時ポリシーの詳細は
            {' '}
            <Link href="/settings?tab=storage" className="font-semibold text-blue-700 hover:underline">
              容量設定
            </Link>
            {' '}
            で確認できます。
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Checkout</p>
          <h2 className="text-lg font-semibold text-gray-900">基本料金・オプション料金の決済</h2>
          <p className="mt-1.5 text-sm text-gray-700">
            基本料金と有効化中オプションの契約決済を開始します。
          </p>
          <div className="mt-4">
            <PaymentMethodButtons
              defaultPlanCode={storeSubscription?.plan_code ?? 'light'}
              defaultBillingCycle={storeSubscription?.billing_cycle ?? 'monthly'}
              hotelOptionEnabled={hotelOptionEnabled}
              notificationOptionEnabled={notificationOptionEnabled}
              aiPlanCode={aiPlanCode}
              ownerActiveStoreCount={ownerActiveStoreCount}
            />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">One-time</p>
        <h2 className="text-lg font-semibold text-gray-900">初期設定代行</h2>
        <p className="mt-1.5 text-sm text-gray-700">
          初期設定代行のみを決済します。決済完了後に運営側で設定作業を開始します。
        </p>
        <div className="mt-4">
          <SetupAssistanceCheckoutButton />
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Operations</p>
        <h2 className="text-lg font-semibold text-gray-900">運用操作</h2>
        <div className="mt-4">
          <BillingOperationsPanel preferredProvider={storeSubscription?.preferred_provider ?? null} />
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Provider Status</p>
        <h2 className="text-lg font-semibold text-gray-900">プロバイダ状態</h2>
        {billingSubscriptions && billingSubscriptions.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">provider</th>
                  <th className="px-2 py-2 font-medium">status</th>
                  <th className="px-2 py-2 font-medium">provider_subscription_id</th>
                  <th className="px-2 py-2 font-medium">current_period_end</th>
                  <th className="px-2 py-2 font-medium">updated_at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billingSubscriptions.map((row) => (
                  <tr key={`${row.provider}-${row.provider_subscription_id ?? 'none'}`} className="text-gray-700">
                    <td className="px-2 py-2.5">{row.provider}</td>
                    <td className="px-2 py-2.5">{row.status}</td>
                    <td className="px-2 py-2.5">{row.provider_subscription_id ?? '-'}</td>
                    <td className="px-2 py-2.5">{formatBillingDateTimeJst(row.current_period_end ?? null)}</td>
                    <td className="px-2 py-2.5">{formatBillingDateTimeJst(row.updated_at ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">まだ決済履歴がありません。</p>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Activity Log</p>
        <h2 className="text-lg font-semibold text-gray-900">最近の操作履歴</h2>
        {operations && operations.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">日時</th>
                  <th className="px-2 py-2 font-medium">provider</th>
                  <th className="px-2 py-2 font-medium">operation</th>
                  <th className="px-2 py-2 font-medium">amount</th>
                  <th className="px-2 py-2 font-medium">status</th>
                  <th className="px-2 py-2 font-medium">reason/result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {operations.map((row, index) => (
                  <tr key={`${row.created_at}-${index}`} className="text-gray-700">
                    <td className="px-2 py-2.5">{formatBillingDateTimeJst(row.created_at)}</td>
                    <td className="px-2 py-2.5">{row.provider}</td>
                    <td className="px-2 py-2.5">{billingOperationTypeLabel(row.operation_type)}</td>
                    <td className="px-2 py-2.5">{row.amount_jpy ?? '-'}</td>
                    <td className="px-2 py-2.5">{row.status}</td>
                    <td className="px-2 py-2.5">{row.reason || row.result_message || '-'}</td>
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
