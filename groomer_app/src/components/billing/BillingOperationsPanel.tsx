'use client'

import { useState } from 'react'

type Provider = 'stripe' | 'komoju'
type ActionType = 'cancel_immediately' | 'cancel_at_period_end' | 'refund_request'

type BillingOperationsPanelProps = {
  preferredProvider: Provider | null
}

export function BillingOperationsPanel({ preferredProvider }: BillingOperationsPanelProps) {
  const [provider, setProvider] = useState<Provider>(preferredProvider ?? 'stripe')
  const [action, setAction] = useState<ActionType>('cancel_at_period_end')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const actionLabel: Record<ActionType, string> = {
    cancel_at_period_end: '期間終了で解約',
    cancel_immediately: '即時解約',
    refund_request: '返金依頼を記録',
  }

  async function updatePreferredProvider(nextProvider: Provider) {
    setIsLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/billing/preferred-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: nextProvider }),
      })
      const json = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(json.message ?? '更新に失敗しました。')
      }
      setProvider(nextProvider)
      setMessage('優先決済手段を更新しました。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  async function submitOperation() {
    setIsLoading(true)
    setError('')
    setMessage('')
    try {
      if (action === 'cancel_immediately') {
        const confirmed = window.confirm(
          '即時解約を実行すると、契約が直ちにキャンセル状態となり、日割返金は行われません。実行しますか？'
        )
        if (!confirmed) {
          setIsLoading(false)
          return
        }
      }
      if (action === 'cancel_at_period_end') {
        const confirmed = window.confirm(
          '期間終了時解約を設定します。次回更新日以降の自動課金が停止されます。実行しますか？'
        )
        if (!confirmed) {
          setIsLoading(false)
          return
        }
      }
      const response = await fetch('/api/billing/subscription/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          action,
          reason: reason || null,
          amount_jpy: action === 'refund_request' ? Number(amount || 0) : null,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(json.message ?? '操作に失敗しました。')
      }
      setMessage(json.message ?? '操作を受け付けました。')
      if (action === 'refund_request') setAmount('')
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-gray-50 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-900">決済手段の切替</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => updatePreferredProvider('stripe')}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              provider === 'stripe'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            Stripeへ切替
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => updatePreferredProvider('komoju')}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              provider === 'komoju'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            KOMOJUへ切替
          </button>
        </div>
      </div>

      <div className="rounded border bg-gray-50 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-900">返金 / 解約オペレーション補助</p>
        <p className="mb-2 text-xs text-gray-600">
          解約実行前に、請求停止タイミング（即時/期間終了時）と返金有無を必ず確認してください。
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-gray-700">
            決済手段
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              className="w-full rounded border p-2"
            >
              <option value="stripe">クレジットカード（Stripe）</option>
              <option value="komoju">キャリア決済（KOMOJU）</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            操作
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as ActionType)}
              className="w-full rounded border p-2"
            >
              <option value="cancel_at_period_end">{actionLabel.cancel_at_period_end}</option>
              <option value="cancel_immediately">{actionLabel.cancel_immediately}</option>
              <option value="refund_request">{actionLabel.refund_request}</option>
            </select>
          </label>
          {action === 'refund_request' ? (
            <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
              返金金額（円）
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min={0}
                className="w-full rounded border p-2"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
            理由（任意）
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="w-full rounded border p-2"
            />
          </label>
        </div>
        <div className="mt-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              void submitOperation()
            }}
            className="rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            実行
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
