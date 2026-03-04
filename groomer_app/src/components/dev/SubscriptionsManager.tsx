'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type StoreRow = {
  id: string
  name: string
  is_active: boolean
}

type SubscriptionRow = {
  store_id: string
  plan_code: string
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
          store_id: {store.id} / 店舗ステータス: {store.is_active ? 'active' : 'inactive'}
        </p>
        <p className="text-xs text-gray-500">
          試用期間: 開始 {trialStart} / 日数 {trialDays} 日 / 終了予定 {trialEnd}
        </p>
        <p className="text-xs text-gray-500">
          past_due 猶予: {graceDays} 日 / past_due開始: {toDateInput(subscription?.past_due_since ?? null) || '-'}
        </p>
      </div>

      <form
        action={`/api/dev/subscriptions/${store.id}`}
        method="post"
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <label className="space-y-1 text-sm text-gray-700">
          plan_code
          <Input
            name="plan_code"
            required
            defaultValue={subscription?.plan_code ?? 'free'}
            placeholder="free / basic / pro"
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          amount_jpy
          <Input
            name="amount_jpy"
            type="number"
            min={0}
            required
            defaultValue={subscription?.amount_jpy ?? 0}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          billing_status
          <select
            name="billing_status"
            defaultValue={subscription?.billing_status ?? 'inactive'}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="inactive">inactive</option>
            <option value="trialing">trialing</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="paused">paused</option>
            <option value="canceled">canceled</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          billing_cycle
          <select
            name="billing_cycle"
            defaultValue={subscription?.billing_cycle ?? 'monthly'}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
            <option value="custom">custom</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          preferred_provider
          <select
            name="preferred_provider"
            defaultValue={subscription?.preferred_provider ?? ''}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">(未選択)</option>
            <option value="stripe">stripe</option>
            <option value="komoju">komoju</option>
          </select>
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          trial_days
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
          grace_days
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
          trial_started_at
          <Input
            name="trial_started_at"
            type="date"
            defaultValue={trialStart}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          current_period_start
          <Input
            name="current_period_start"
            type="date"
            defaultValue={toDateInput(subscription?.current_period_start ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700">
          current_period_end
          <Input
            name="current_period_end"
            type="date"
            defaultValue={toDateInput(subscription?.current_period_end ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
          next_billing_date
          <Input
            name="next_billing_date"
            type="date"
            defaultValue={toDateInput(subscription?.next_billing_date ?? null)}
          />
        </label>

        <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
          notes
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
                      <td className="px-2 py-3">{store.is_active ? 'active' : 'inactive'}</td>
                      <td className="px-2 py-3">{subscription?.billing_status ?? 'inactive'}</td>
                      <td className="px-2 py-3">{subscription?.preferred_provider ?? '-'}</td>
                      <td className="px-2 py-3">{subscription?.plan_code ?? 'free'}</td>
                      <td className="px-2 py-3">{(subscription?.amount_jpy ?? 0).toLocaleString()}</td>
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
