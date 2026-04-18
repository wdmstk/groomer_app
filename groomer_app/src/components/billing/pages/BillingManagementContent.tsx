import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
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

const BillingOperationsPanel = nextDynamic(
  () => import('@/components/billing/BillingOperationsPanel').then((mod) => mod.BillingOperationsPanel),
  {
    loading: () => <p className="text-sm text-gray-500 dark:text-slate-400">課金操作を読み込み中...</p>,
  }
)

const BillingCheckoutAgreementSection = nextDynamic(
  () =>
    import('@/components/billing/BillingCheckoutAgreementSection').then(
      (mod) => mod.BillingCheckoutAgreementSection
    ),
  {
    loading: () => <p className="text-sm text-gray-500 dark:text-slate-400">決済パネルを読み込み中...</p>,
  }
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
      'plan_code, hotel_option_requested, hotel_option_effective, hotel_option_enabled, notification_option_requested, notification_option_effective, notification_option_enabled, ai_plan_code_requested, ai_plan_code_effective, ai_plan_code, billing_cycle, billing_status, preferred_provider, amount_jpy, trial_started_at, trial_days, grace_days, past_due_since, current_period_end, next_billing_date'
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">決済管理</h1>
        <Card>
          <p className="text-sm text-red-700 dark:text-red-300">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId, user } = guard
  const admin = isPlaywrightE2E ? null : createAdminSupabaseClient()
  const adminClient = admin as NonNullable<typeof admin>
  const ownerActiveStoreCount = isPlaywrightE2E
    ? billingPageFixtures.ownerActiveStoreCount
    : await countActiveOwnerStores(user.id)
  const storeSubscription = isPlaywrightE2E
    ? billingPageFixtures.storeSubscription
    : await fetchStoreSubscriptionWithAiFallback(adminClient, storeId)
  const billingSubscriptions = isPlaywrightE2E
    ? billingPageFixtures.billingSubscriptions
    : (
        await adminClient
          .from('billing_subscriptions')
          .select('provider, status, provider_subscription_id, subscription_scope, storage_addon_units, current_period_end, updated_at')
          .eq('store_id', storeId)
          .order('updated_at', { ascending: false })
      ).data
  const storagePolicy = isPlaywrightE2E
    ? billingPageFixtures.storagePolicy
    : (
        await adminClient
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
  const hotelOptionEffective =
    ((storeSubscription as (typeof storeSubscription & { hotel_option_effective?: boolean | null }) | null)
      ?.hotel_option_effective ??
      storeSubscription?.hotel_option_enabled ??
      false) === true
  const hotelOptionRequested =
    ((storeSubscription as (typeof storeSubscription & { hotel_option_requested?: boolean | null }) | null)
      ?.hotel_option_requested ??
      hotelOptionEffective) === true
  const notificationOptionEffective =
    ((storeSubscription as (typeof storeSubscription & { notification_option_effective?: boolean | null }) | null)
      ?.notification_option_effective ??
      storeSubscription?.notification_option_enabled ??
      false) === true
  const notificationOptionRequested =
    ((storeSubscription as (typeof storeSubscription & { notification_option_requested?: boolean | null }) | null)
      ?.notification_option_requested ??
      notificationOptionEffective) === true
  const aiPlanEffective = parseAiPlanCode(
    (storeSubscription as (typeof storeSubscription & { ai_plan_code_effective?: string | null; ai_plan_code?: string | null }) | null)
      ?.ai_plan_code_effective ??
      (storeSubscription as (typeof storeSubscription & { ai_plan_code?: string | null }) | null)?.ai_plan_code ??
      'none'
  )
  const aiPlanRequested = parseAiPlanCode(
    (storeSubscription as (typeof storeSubscription & { ai_plan_code_requested?: string | null }) | null)
      ?.ai_plan_code_requested ??
      aiPlanEffective
  )
  const hotelOptionPending = hotelOptionRequested !== hotelOptionEffective
  const notificationOptionPending = notificationOptionRequested !== notificationOptionEffective
  const aiPlanPending = aiPlanRequested !== aiPlanEffective
  const baseAmountJpy = amountForPlan(normalizedPlanCode, billingCycle)
  const discountedBaseAmountJpy = amountForPlanWithStoreCount(
    normalizedPlanCode,
    billingCycle,
    ownerActiveStoreCount
  )
  const baseDiscountJpy = Math.max(0, baseAmountJpy - discountedBaseAmountJpy)
  const optionAmountJpy = amountForOptions(normalizedPlanCode, billingCycle, {
    hotelOptionEnabled: hotelOptionEffective,
    notificationOptionEnabled: notificationOptionEffective,
    aiPlanCode: aiPlanEffective,
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">決済管理</h1>
      </div>
      {params?.message ? (
        <Card className="border border-emerald-300 bg-gray-50">
          <p className="text-sm text-emerald-700">{params.message}</p>
        </Card>
      ) : null}
      {params?.error ? (
        <Card className="border border-red-300 bg-gray-50">
          <p className="text-sm text-red-700">{params.error}</p>
        </Card>
      ) : null}

      {showUrgentAlert ? (
        <Card className="border border-red-300 bg-gray-50">
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-400">Overview</p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">契約サマリー</h2>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-slate-300 md:grid-cols-2">
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">プラン</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{planLabel(normalizedPlanCode)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">請求周期</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{billingCycleLabel}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">AIプラン</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {aiPlanLabel(aiPlanEffective)}
                {aiPlanPending ? `（申込中: ${aiPlanLabel(aiPlanRequested)}）` : ''}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">基本+オプション請求額</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {typeof storeSubscription?.amount_jpy === 'number' ? `${storeSubscription.amount_jpy} 円` : `${coreBilledAmountJpy} 円`}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">ステータス</span>
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  getBillingStatusBadgeClass(storeSubscription?.billing_status ?? 'inactive')
                }`}
              >
                {storeSubscription?.billing_status ?? 'inactive'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">優先決済手段</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{storeSubscription?.preferred_provider ?? '-'}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">次回請求予定日</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{storeSubscription?.next_billing_date ?? '-'}</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">基本+オプション契約終了日</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {formatBillingDateTimeJst(
                  storeSubscription?.current_period_end ?? coreSubscription?.current_period_end ?? null
                )}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">利用停止まで</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {typeof daysUntilTrialEnd === 'number'
                  ? isTrialExpired
                    ? '期限超過'
                    : `${daysUntilTrialEnd} 日`
                  : '-'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">試用開始日</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {formatBillingDateOnlyJst(storeSubscription?.trial_started_at ?? null)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">試用日数</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{storeSubscription?.trial_days ?? 30} 日</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">試用終了予定日</span>
              <span className={isTrialExpired ? 'font-medium text-red-700 dark:text-red-300' : 'font-medium text-gray-900 dark:text-slate-100'}>
                {trialEnd ? formatBillingDateTimeJst(trialEnd.toISOString()) : '-'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700 pb-1.5">
              <span className="text-gray-500 dark:text-slate-400">past_due猶予日数</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{storeSubscription?.grace_days ?? 3} 日</span>
            </p>
            <p className="flex items-center justify-between gap-4 md:col-span-2">
              <span className="text-gray-500 dark:text-slate-400">past_due開始日時</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {formatBillingDateTimeJst(storeSubscription?.past_due_since ?? null)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-4 md:col-span-2">
              <span className="text-gray-500 dark:text-slate-400">容量追加 次回請求予定日</span>
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {formatBillingDateTimeJst(storageSubscription?.current_period_end ?? null)}
              </span>
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-400">Breakdown</p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">料金内訳</h2>
          <div className="mt-3 space-y-2.5 text-sm text-gray-700 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2">
              <span>基本料金 定価</span>
              <span className="font-medium">{baseAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2">
              <span>複数店舗割引</span>
              <span className="font-medium">-{baseDiscountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2">
              <span>オプション料金</span>
              <span className="font-medium">{optionAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2">
              <span>追加容量料金（{storageCycleLabel}）</span>
              <span className="font-medium">{storageAddonAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-1 text-xs text-gray-500 dark:text-slate-400">
              <span>現在の追加容量</span>
              <span>{extraCapacityGb} GB</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-base font-semibold text-gray-900 dark:text-slate-100">
              <span>基本+オプション請求額</span>
              <span>{coreBilledAmountJpy.toLocaleString('ja-JP')} 円</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            容量追加は基本契約とは別の月額継続契約として扱います。
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-400">Add-ons</p>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">オプション契約</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-slate-300 xl:grid-cols-2">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900 dark:text-slate-100">{optionLabel('hotel')}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${hotelOptionEffective ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                {hotelOptionEffective ? '有効' : '未契約'}
              </span>
            </div>
            {hotelOptionPending ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                申込中: {hotelOptionRequested ? '有効化' : '無効化'}（支払い確定後に反映）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">対象: スタンダード / プロ</p>
            <form action="/api/billing/options" method="post" className="mt-2">
              <input type="hidden" name="option" value="hotel" />
              <input type="hidden" name="hotel_option_enabled" value={hotelOptionRequested ? 'false' : 'true'} />
              <button
                type="submit"
                disabled={!canPurchaseOptions}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hotelOptionRequested ? '無効化を申込む' : '有効化を申込む'}
              </button>
            </form>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900 dark:text-slate-100">{optionLabel('notification')}</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${notificationOptionEffective ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                {notificationOptionEffective ? '有効' : '未契約'}
              </span>
            </div>
            {notificationOptionPending ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                申込中: {notificationOptionRequested ? '有効化' : '無効化'}（支払い確定後に反映）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">対象: スタンダード / プロ</p>
            <form action="/api/billing/options" method="post" className="mt-2">
              <input type="hidden" name="option" value="notification" />
              <input
                type="hidden"
                name="notification_option_enabled"
                value={notificationOptionRequested ? 'false' : 'true'}
              />
              <button
                type="submit"
                disabled={!canPurchaseOptions}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {notificationOptionRequested ? '無効化を申込む' : '有効化を申込む'}
              </button>
            </form>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-gray-900 dark:text-slate-100">AIプラン</p>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${aiPlanEffective === 'none' ? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                {aiPlanLabel(aiPlanEffective)}
              </span>
            </div>
            {aiPlanPending ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                申込中: {aiPlanLabel(aiPlanRequested)}（支払い確定後に反映）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">プラン変更は申込後、支払い確定時に有効化されます。</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="none" />
                <button
                  type="submit"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  無効化
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="assist" />
                <button
                  type="submit"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Assist (1,280円)
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="pro" />
                <button
                  type="submit"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Pro (1,980円)
                </button>
              </form>
              <form action="/api/billing/options" method="post">
                <input type="hidden" name="option" value="ai_plan" />
                <input type="hidden" name="ai_plan_code" value="pro_plus" />
                <button
                  type="submit"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Pro+ (2,480円)
                </button>
              </form>
            </div>
          </div>
          {!canPurchaseOptions ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ライトプランではオプション契約はできません。スタンダード以上へ変更してください。
            </p>
          ) : null}
        </div>
      </Card>

      <BillingCheckoutAgreementSection
        extraCapacityGb={extraCapacityGb}
        defaultPlanCode={storeSubscription?.plan_code ?? 'light'}
        defaultBillingCycle={storeSubscription?.billing_cycle ?? 'monthly'}
        hotelOptionEnabled={hotelOptionRequested}
        notificationOptionEnabled={notificationOptionRequested}
        aiPlanCode={aiPlanRequested}
        ownerActiveStoreCount={ownerActiveStoreCount}
      />

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-400">Operations</p>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">運用操作</h2>
        <div className="mt-4">
          <BillingOperationsPanel preferredProvider={storeSubscription?.preferred_provider ?? null} />
        </div>
      </Card>
    </section>
  )
}
