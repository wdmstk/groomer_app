'use client'

import { useState } from 'react'

type CancelReservationClientProps = {
  token: string
}

export function CancelReservationClient({ token }: CancelReservationClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleCancel() {
    if (!token) {
      setError('無効なURLです。')
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/public/reserve/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await response.json().catch(() => ({}))) as { message?: string }

      if (!response.ok) {
        setError(json.message ?? 'キャンセルに失敗しました。')
        return
      }

      setMessage(json.message ?? '予約をキャンセルしました。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <section className="mx-auto max-w-lg rounded-lg border bg-white p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-gray-900">予約キャンセル</h1>
        <p className="mt-2 text-sm text-gray-600">
          この操作で予約申請（または予約）をキャンセルします。よろしければ実行してください。
        </p>

        <button
          type="button"
          onClick={() => {
            void handleCancel()
          }}
          disabled={isSubmitting}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isSubmitting ? '処理中...' : '予約をキャンセルする'}
        </button>

        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  )
}
