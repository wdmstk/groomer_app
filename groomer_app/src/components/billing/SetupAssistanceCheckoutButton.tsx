'use client'

import { useState } from 'react'
import { SETUP_ASSISTANCE_FEE_JPY } from '@/lib/billing/pricing'

type Provider = 'stripe' | 'komoju'

export function SetupAssistanceCheckoutButton() {
  const [isLoading, setIsLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  async function startCheckout(provider: Provider) {
    setIsLoading(provider)
    setError('')
    try {
      const response = await fetch('/api/billing/setup-assistance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          return_url: `${window.location.origin}/billing/success?provider=${provider}&mode=setup-assistance`,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        checkout_url?: string
        message?: string
      }
      if (!response.ok || !json.checkout_url) {
        throw new Error(json.message ?? '初期設定代行の決済画面に遷移できませんでした。')
      }
      window.location.href = json.checkout_url
    } catch (e) {
      setError(e instanceof Error ? e.message : '初期設定代行の決済開始に失敗しました。')
      setIsLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">
        料金: {SETUP_ASSISTANCE_FEE_JPY.toLocaleString('ja-JP')}円
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
