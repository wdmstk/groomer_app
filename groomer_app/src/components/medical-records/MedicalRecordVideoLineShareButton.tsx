'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type MedicalRecordVideoLineShareButtonProps = {
  videoId: string
}

export function MedicalRecordVideoLineShareButton({ videoId }: MedicalRecordVideoLineShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleShare = async () => {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const lineShortResponse = await fetch(`/api/medical-records/videos/${videoId}/line-short`, {
        method: 'POST',
      })
      const lineShortPayload = (await lineShortResponse.json().catch(() => null)) as
        | { message?: string }
        | null
      if (!lineShortResponse.ok) {
        throw new Error(lineShortPayload?.message ?? 'LINE短尺動画の生成に失敗しました。')
      }

      const shareResponse = await fetch(`/api/medical-records/videos/${videoId}/share-line`, {
        method: 'POST',
      })
      const sharePayload = (await shareResponse.json().catch(() => null)) as
        | { message?: string }
        | null
      if (!shareResponse.ok) {
        throw new Error(sharePayload?.message ?? 'LINE送信に失敗しました。')
      }

      setMessage('LINEへ動画カルテを送信しました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'LINE送信に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className="px-2 py-1 text-xs bg-slate-900 hover:bg-slate-800"
      >
        {loading ? '送信中...' : 'LINE送信'}
      </Button>
      {error ? (
        <div className="space-y-1">
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={handleShare}
            disabled={loading}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            再試行
          </button>
        </div>
      ) : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
    </div>
  )
}
