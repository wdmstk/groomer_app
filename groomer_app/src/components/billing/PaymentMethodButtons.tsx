'use client'

import { useState } from 'react'
import Link from 'next/link'
import { normalizePlanCode, type AppPlan } from '@/lib/subscription-plan'
import {
  amountForPlanWithStoreCountAndOptions,
  parseAiPlanCode,
  parseBillingCycle,
  type AiPlanCode,
  type BillingCycle,
} from '@/lib/billing/pricing'

type Provider = 'stripe' | 'komoju'
type PaymentMethodButtonsProps = {
  defaultPlanCode?: string | null
  defaultBillingCycle?: string | null
  hotelOptionEnabled?: boolean
  notificationOptionEnabled?: boolean
  aiPlanCode?: AiPlanCode
  ownerActiveStoreCount?: number
}

export function PaymentMethodButtons({
  defaultPlanCode,
  defaultBillingCycle,
  hotelOptionEnabled = false,
  notificationOptionEnabled = false,
  aiPlanCode = 'none',
  ownerActiveStoreCount = 1,
}: PaymentMethodButtonsProps) {
  const skipApplicationValidation = process.env.NODE_ENV !== 'production'
  const [isLoading, setIsLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')
  const [legalAgreed, setLegalAgreed] = useState(false)
  const [planCode, setPlanCode] = useState<AppPlan>(normalizePlanCode(defaultPlanCode))
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    parseBillingCycle(defaultBillingCycle)
  )
  const selectedAmount = amountForPlanWithStoreCountAndOptions(
    planCode,
    billingCycle,
    ownerActiveStoreCount,
    {
      hotelOptionEnabled,
      notificationOptionEnabled,
      aiPlanCode,
    }
  )

  async function startCheckout(provider: Provider) {
    setError('')
    if (!skipApplicationValidation && !legalAgreed) {
      setError('決済前に、利用規約・プライバシーポリシー・特定商取引法表記への同意が必要です。')
      return
    }
    setIsLoading(provider)
    try {
      const endpoint =
        provider === 'stripe' ? '/api/billing/stripe/checkout' : '/api/billing/komoju/checkout'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_url: `${window.location.origin}/billing/success?provider=${provider}`,
          plan_code: planCode,
          billing_cycle: billingCycle,
          ai_plan_code: parseAiPlanCode(aiPlanCode),
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-sm text-gray-700">
          プラン
          <select
            value={planCode}
            onChange={(event) => setPlanCode(normalizePlanCode(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            disabled={isLoading !== null}
          >
            <option value="light">ライト</option>
            <option value="standard">スタンダード</option>
            <option value="pro">プロ</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          請求周期
          <select
            value={billingCycle}
            onChange={(event) => setBillingCycle(parseBillingCycle(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            disabled={isLoading !== null}
          >
            <option value="monthly">月払い</option>
            <option value="yearly">年払い</option>
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-gray-900">
          選択中の料金: {selectedAmount.toLocaleString('ja-JP')}円
          <span className="ml-1 text-xs font-normal text-gray-600">
            / {billingCycle === 'yearly' ? '年' : '月'}
          </span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isLoading !== null || (!skipApplicationValidation && !legalAgreed)}
            onClick={() => startCheckout('stripe')}
            className="inline-flex items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isLoading === 'stripe' ? '遷移中...' : 'クレジットカード（Stripe）'}
          </button>
          <button
            type="button"
            disabled={isLoading !== null || (!skipApplicationValidation && !legalAgreed)}
            onClick={() => startCheckout('komoju')}
            className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isLoading === 'komoju' ? '遷移中...' : 'キャリア決済（KOMOJU）'}
          </button>
        </div>
      </div>
      <label className="block rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
        <span className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={legalAgreed}
            onChange={(event) => setLegalAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            決済を実行すると、
            <Link href="/legal/terms" className="text-blue-700 hover:underline">
              利用規約
            </Link>
            ・
            <Link href="/legal/privacy" className="text-blue-700 hover:underline">
              プライバシーポリシー
            </Link>
            ・
            <Link href="/legal/tokusho" className="text-blue-700 hover:underline">
              特定商取引法に基づく表記
            </Link>
            に同意したものとみなされます。
          </span>
        </span>
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
