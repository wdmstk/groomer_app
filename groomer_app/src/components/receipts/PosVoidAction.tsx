'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PosVoidActionProps = {
  orderId: string
  disabled?: boolean
}

export function PosVoidAction({ orderId, disabled = false }: PosVoidActionProps) {
  const router = useRouter()
  const [reason, setReason] = useState('誤入力')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submitVoid() {
    if (disabled || !orderId || !reason.trim()) return
    const confirmed = window.confirm('この会計を取消します。実行してよろしいですか？')
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pos-void-${Date.now()}-${Math.random()}`
      const response = await fetch(`/api/pos/orders/${orderId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          idempotency_key: idempotencyKey,
        }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? '取消に失敗しました。')
      }
      setDone(true)
      router.refresh()
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : '取消に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-900">POS取消</p>
      <p className="mt-1 text-xs text-red-800">誤会計時に伝票を取消し、物販在庫を自動で戻します。</p>
      {done ? <p className="mt-2 text-xs text-emerald-700">取消を完了しました。</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      <label className="mt-2 block text-xs text-red-900">
        取消理由
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded border border-red-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          disabled={submitting || disabled || done}
        />
      </label>
      <button
        type="button"
        onClick={() => void submitVoid()}
        disabled={submitting || disabled || done || !reason.trim()}
        className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
      >
        {submitting ? '取消中...' : 'この会計を取消'}
      </button>
    </div>
  )
}
