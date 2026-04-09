'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type MedicalRecordShareButtonProps = {
  recordId: string
}

export function MedicalRecordShareButton({ recordId }: MedicalRecordShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [error, setError] = useState('')
  const [lineMessage, setLineMessage] = useState('')

  const handleCreateShare = async () => {
    setLoading(true)
    setError('')
    setLineMessage('')
    try {
      const response = await fetch(`/api/medical-records/${recordId}/share`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as
        | { shareUrl?: string; message?: string }
        | null
      if (!response.ok || !payload?.shareUrl) {
        throw new Error(payload?.message ?? '共有URLの発行に失敗しました。')
      }
      setShareUrl(payload.shareUrl)
      await navigator.clipboard.writeText(payload.shareUrl).catch(() => undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '共有URLの発行に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  const handleSendLineShare = async () => {
    setLineLoading(true)
    setError('')
    setLineMessage('')
    try {
      const response = await fetch(`/api/medical-records/${recordId}/share-line`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'LINE送信に失敗しました。')
      }
      setLineMessage('LINEへ写真カルテを送信しました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'LINE送信に失敗しました。')
    } finally {
      setLineLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleCreateShare}
          disabled={loading}
          className="h-7 whitespace-nowrap bg-emerald-600 px-2 py-0 text-xs hover:bg-emerald-700"
        >
          {loading ? '発行中...' : 'URLコピー'}
        </Button>
        <Button
          type="button"
          onClick={handleSendLineShare}
          disabled={lineLoading}
          className="h-7 whitespace-nowrap bg-slate-900 px-2 py-0 text-xs hover:bg-slate-800"
        >
          {lineLoading ? '送信中...' : 'LINE送信'}
        </Button>
      </div>
      {shareUrl ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          <p>7日間有効のURLを発行しました。クリックボードへコピー済みです。</p>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="break-all underline">
            {shareUrl}
          </a>
        </div>
      ) : null}
      {lineMessage ? <p className="text-xs text-emerald-700">{lineMessage}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
