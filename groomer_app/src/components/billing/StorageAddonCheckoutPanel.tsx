'use client'

import { useMemo, useState } from 'react'
import {
  amountForStorageAddonUnits,
  STORAGE_ADDON_UNIT_GB,
} from '@/lib/billing/pricing'

type Provider = 'stripe' | 'komoju'

export function StorageAddonCheckoutPanel() {
  const [units, setUnits] = useState(1)
  const [isLoading, setIsLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  const addonGb = useMemo(() => Math.max(1, units) * STORAGE_ADDON_UNIT_GB, [units])
  const amountJpy = useMemo(() => amountForStorageAddonUnits(Math.max(1, units)), [units])

  async function startCheckout(provider: Provider) {
    setIsLoading(provider)
    setError('')
    try {
      const response = await fetch('/api/billing/storage-addon/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          units: Math.max(1, units),
          return_url: `${window.location.origin}/billing/success?provider=${provider}&mode=storage-addon`,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        checkout_url?: string
        message?: string
      }
      if (!response.ok || !json.checkout_url) {
        throw new Error(json.message ?? '容量アドオンの決済画面に遷移できませんでした。')
      }
      window.location.href = json.checkout_url
    } catch (e) {
      setError(e instanceof Error ? e.message : '容量アドオンの決済開始に失敗しました。')
      setIsLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-gray-700">
        追加ユニット（10GB単位）
        <input
          type="number"
          min={1}
          step={1}
          value={units}
          onChange={(event) => setUnits(Number.parseInt(event.target.value || '1', 10) || 1)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 md:max-w-sm"
          disabled={isLoading !== null}
        />
      </label>
      <p className="text-sm font-semibold text-gray-900">
        追加容量: {addonGb}GB / 追加料金: {amountJpy.toLocaleString('ja-JP')}円/月
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isLoading !== null}
          onClick={() => {
            void startCheckout('stripe')
          }}
          className="inline-flex items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isLoading === 'stripe' ? '遷移中...' : 'クレジットカード（Stripe）'}
        </button>
        <button
          type="button"
          disabled={isLoading !== null}
          onClick={() => {
            void startCheckout('komoju')
          }}
          className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isLoading === 'komoju' ? '遷移中...' : 'キャリア決済（KOMOJU）'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
