'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { normalizePlanCode, planLabel } from '@/lib/subscription-plan'

type StoreRow = {
  id: string
  name: string
  is_active: boolean
}

type SubscriptionRow = {
  store_id: string
  plan_code: string
  hotel_option_enabled: boolean | null
  notification_option_enabled: boolean | null
  billing_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'
  billing_cycle: 'monthly' | 'yearly' | 'custom'
  preferred_provider: 'stripe' | 'komoju' | null
  amount_jpy: number
  current_period_start: string | null
  current_period_end: string | null
  next_billing_date: string | null
  trial_days: number | null
  trial_started_at: string | null
  grace_days: number | null
  past_due_since: string | null
  notes: string | null
}

type SubscriptionsManagerProps = {
  stores: StoreRow[]
  subscriptions: SubscriptionRow[]
  message?: string
}

const STORE_STATUS_LABEL: Record<'active' | 'inactive', string> = {
  active: '稼働中',
  inactive: '停止中',
}

const BILLING_STATUS_LABEL: Record<SubscriptionRow['billing_status'], string> = {
  inactive: '未契約',
  trialing: '無料期間',
  active: '契約中',
  past_due: '支払い遅延',
  paused: '一時停止',
  canceled: '解約済み',
}

const BILLING_CYCLE_LABEL: Record<SubscriptionRow['billing_cycle'], string> = {
  monthly: '月次',
  yearly: '年次',
  custom: 'カスタム',
}

const PROVIDER_LABEL: Record<'stripe' | 'komoju', string> = {
  stripe: 'Stripe',
  komoju: 'KOMOJU',
}

function toDateInput(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function trialSummary(subscription: SubscriptionRow | undefined) {
  const trialDays = Math.max(0, subscription?.trial_days ?? 30)
  const trialStart = toDateInput(subscription?.trial_started_at ?? null) || toDateInput(new Date().toISOString())
  const trialEnd = (() => {
    const start = new Date(trialStart)
    if (Number.isNaN(start.getTime())) return '未設定'
    return addDays(start, trialDays).toISOString().slice(0, 10)
  })()
  return { trialDays, trialStart, trialEnd }
}

function StoreSubscriptionForm({
  store,
  subscription,
}: {
  store: StoreRow
  subscription: SubscriptionRow | undefined
}) {
  const { trialDays, trialStart, trialEnd } = trialSummary(subscription)
  const graceDays = Math.max(0, subscription?.grace_days ?? 3)

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-900">{store.name}</h2>
        <p className="text-xs text-gray-500">
          店舗ID: {store.id} / 店舗ステータス: {store.is_active ? STORE_STATUS_LABEL.active : STORE_STATUS_LABEL.inactive}
        </p>
        <p className="text-xs text-gray-500">
          試用期間: 開始 {trialStart} / 日数 {trialDays} 日 / 終了予定 {trialEnd}
        </p>
        <p className="text-xs text-gray-500">
          支払い遅延の猶予: {graceDays} 日 / 支払い遅延開始: {toDateInput(subscription?.past_due_since ?? null) || '-'}
        </p>
      </div>

      <form
        action={`/api/dev/subscriptions/${store.id}`}
        method="post"
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <label className="space-y-1 text-sm text-gray-700">
          プラン
          <select
            name="plan_code"
            defaultValue={normalizePlanCode(subscription?.plan_code ?? 'light')}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="light">{planLabel('light')}</option>
            <option value="standard">{planLabel('standard')}</option>
            <option value="pro">{planLabel('pro')}</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          月額料金（円）
          <Input
            name="amount_jpy"
            type="number"
            min={0}
            required
            defaultValue={subscription?.amount_jpy ?? 0}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          課金ステータス
          <select
            name="billing_status"
            defaultValue={subscription?.billing_status ?? 'inactive'}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="inactive">{BILLING_STATUS_LABEL.inactive}</option>
            <option value="trialing">{BILLING_STATUS_LABEL.trialing}</option>
            <option value="active">{BILLING_STATUS_LABEL.active}</option>
            <option value="past_due">{BILLING_STATUS_LABEL.past_due}</option>
            <option value="paused">{BILLING_STATUS_LABEL.paused}</option>
            <option value="canceled">{BILLING_STATUS_LABEL.canceled}</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          請求サイクル
          <select
            name="billing_cycle"
            defaultValue={subscription?.billing_cycle ?? 'monthly'}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="monthly">{BILLING_CYCLE_LABEL.monthly}</option>
            <option value="yearly">{BILLING_CYCLE_LABEL.yearly}</option>
            <option value="custom">{BILLING_CYCLE_LABEL.custom}</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          決済プロバイダ
          <select
            name="preferred_provider"
            defaultValue={subscription?.preferred_provider ?? ''}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">(未選択)</option>
            <option value="stripe">{PROVIDER_LABEL.stripe}</option>
            <option value="komoju">{PROVIDER_LABEL.komoju}</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
          <input type="hidden" name="hotel_option_enabled" value="false" />
          <input
            type="checkbox"
            name="hotel_option_enabled"
            value="true"
            defaultChecked={subscription?.hotel_option_enabled === true}
          />
          ホテルオプションを有効にする
        </label>

        <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
          <input type="hidden" name="notification_option_enabled" value="false" />
          <input
            type="checkbox"
            name="notification_option_enabled"
            value="true"
            defaultChecked={subscription?.notification_option_enabled === true}
          />
          通知強化オプションを有効にする
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          無料期間（日数）
          <Input
            name="trial_days"
            type="number"
            min={0}
            max={3650}
            required
            defaultValue={trialDays}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          猶予日数
          <Input
            name="grace_days"
            type="number"
            min={0}
            max={365}
            required
            defaultValue={graceDays}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          無料期間の開始日
          <Input
            name="trial_started_at"
            type="date"
            defaultValue={trialStart}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          現在の契約期間（開始日）
          <Input
            name="current_period_start"
            type="date"
            defaultValue={toDateInput(subscription?.current_period_start ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          現在の契約期間（終了日）
          <Input
            name="current_period_end"
            type="date"
            defaultValue={toDateInput(subscription?.current_period_end ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
          次回請求日
          <Input
            name="next_billing_date"
            type="date"
            defaultValue={toDateInput(subscription?.next_billing_date ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
          メモ
          <textarea
            name="notes"
            defaultValue={subscription?.notes ?? ''}
            rows={3}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>

        <div className="md:col-span-2">
          <Button type="submit">保存</Button>
        </div>
      </form>
    </Card>
  )
}

export function SubscriptionsManager({
  stores,
  subscriptions,
  message = '',
}: SubscriptionsManagerProps) {
  const subscriptionByStoreId = useMemo(
    () => new Map(subscriptions.map((item) => [item.store_id, item])),
    [subscriptions]
  )
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id ?? '')
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null

  return (
    <>
      {message ? (
        <Card>
          <p className="text-sm text-gray-800">{message}</p>
        </Card>
      ) : null}

      <div className="space-y-4 md:hidden">
        {stores.map((store) => (
          <StoreSubscriptionForm
            key={store.id}
            store={store}
            subscription={subscriptionByStoreId.get(store.id)}
          />
        ))}
      </div>

      <div className="hidden space-y-4 md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="px-2 py-2">店舗名</th>
                  <th className="px-2 py-2">店舗ステータス</th>
                  <th className="px-2 py-2">課金ステータス</th>
                  <th className="px-2 py-2">決済手段</th>
                  <th className="px-2 py-2">プラン</th>
                  <th className="px-2 py-2">月額(円)</th>
                  <th className="px-2 py-2">ホテルOP</th>
                  <th className="px-2 py-2">通知OP</th>
                  <th className="px-2 py-2">試用終了予定</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stores.map((store) => {
                  const subscription = subscriptionByStoreId.get(store.id)
                  const { trialEnd } = trialSummary(subscription)
                  const isActiveRow = selectedStore?.id === store.id
                  return (
                    <tr
                      key={store.id}
                      className={isActiveRow ? 'bg-blue-50' : 'text-gray-700'}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedStoreId(store.id)}
                          className="text-blue-700 hover:underline"
                        >
                          {store.name}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        {store.is_active ? STORE_STATUS_LABEL.active : STORE_STATUS_LABEL.inactive}
                      </td>
                      <td className="px-2 py-3">
                        {BILLING_STATUS_LABEL[subscription?.billing_status ?? 'inactive']}
                      </td>
                      <td className="px-2 py-3">
                        {subscription?.preferred_provider ? PROVIDER_LABEL[subscription.preferred_provider] : '-'}
                      </td>
                      <td className="px-2 py-3">
                        {planLabel(normalizePlanCode(subscription?.plan_code ?? 'light'))}
                      </td>
                      <td className="px-2 py-3">{(subscription?.amount_jpy ?? 0).toLocaleString()}</td>
                      <td className="px-2 py-3">{subscription?.hotel_option_enabled ? '有効' : '無効'}</td>
                      <td className="px-2 py-3">{subscription?.notification_option_enabled ? '有効' : '無効'}</td>
                      <td className="px-2 py-3">{trialEnd}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedStore ? (
          <StoreSubscriptionForm
            key={selectedStore.id}
            store={selectedStore}
            subscription={subscriptionByStoreId.get(selectedStore.id)}
          />
        ) : (
          <Card>
            <p className="text-sm text-gray-600">店舗が存在しません。</p>
          </Card>
        )}
      </div>
    </>
  )
}
