'use client'

import { useState } from 'react'

type MemberPortalReissueRequestButtonProps = {
  token: string
}

export function MemberPortalReissueRequestButton({ token }: MemberPortalReissueRequestButtonProps) {
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/public/member-portal/${encodeURIComponent(token)}/reissue-request`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? '再発行リクエストの送信に失敗しました。')
      }
      setMessage(payload?.message ?? '再発行リクエストを受け付けました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '再発行リクエストの送信に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          void handleSubmit()
        }}
        disabled={submitting}
        className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? '送信中...' : '再発行を依頼する'}
      </button>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
