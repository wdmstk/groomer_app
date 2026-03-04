'use client'

import { useState } from 'react'

type Provider = 'stripe' | 'komoju'

export function PaymentMethodButtons() {
  const [isLoading, setIsLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  async function startCheckout(provider: Provider) {
    setError('')
    setIsLoading(provider)
    try {
      const endpoint =
        provider === 'stripe' ? '/api/billing/stripe/checkout' : '/api/billing/komoju/checkout'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_url: `${window.location.origin}/billing/success?provider=${provider}`,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        checkout_url?: string
        message?: string
      }
      if (!response.ok || !json.checkout_url) {
        throw new Error(json.message ?? 'Checkout URLの取得に失敗しました。')
      }
      window.location.href = json.checkout_url
    } catch (e) {
      const message = e instanceof Error ? e.message : '決済画面への遷移に失敗しました。'
      setError(message)
      setIsLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isLoading !== null}
          onClick={() => startCheckout('stripe')}
          className="inline-flex items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isLoading === 'stripe' ? '遷移中...' : 'クレジットカード（Stripe）'}
        </button>
        <button
          type="button"
          disabled={isLoading !== null}
          onClick={() => startCheckout('komoju')}
          className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isLoading === 'komoju' ? '遷移中...' : 'キャリア決済（KOMOJU）'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
