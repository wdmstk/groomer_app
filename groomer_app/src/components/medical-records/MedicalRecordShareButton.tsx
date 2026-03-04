'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type MedicalRecordShareButtonProps = {
  recordId: string
}

export function MedicalRecordShareButton({ recordId }: MedicalRecordShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [error, setError] = useState('')

  const handleCreateShare = async () => {
    setLoading(true)
    setError('')
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

  return (
    <div className="space-y-2">
      <Button type="button" onClick={handleCreateShare} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
        {loading ? '発行中...' : 'LINE共有URL'}
      </Button>
      {shareUrl ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          <p>7日間有効のURLを発行しました。クリックボードへコピー済みです。</p>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="break-all underline">
            {shareUrl}
          </a>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
