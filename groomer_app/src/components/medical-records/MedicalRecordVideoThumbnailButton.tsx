'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type MedicalRecordVideoThumbnailButtonProps = {
  videoId: string
  hasThumbnail: boolean
}

export function MedicalRecordVideoThumbnailButton({
  videoId,
  hasThumbnail,
}: MedicalRecordVideoThumbnailButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`/api/medical-records/videos/${videoId}/thumbnail`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { message?: string; reused?: boolean } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'サムネイル生成に失敗しました。')
      }
      setMessage(payload?.reused ? '既存サムネイルを使用中です。' : 'サムネイルを生成しました。再表示で反映されます。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'サムネイル生成に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  if (hasThumbnail) return null

  return (
    <div className="space-y-1">
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500"
      >
        {loading ? '生成中...' : 'サムネ生成'}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
    </div>
  )
}

