'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type Tier = 'assist' | 'pro' | 'pro_plus'

type MedicalRecordVideoAiActionsProps = {
  videoId: string
  aiAssistEnabled: boolean
  aiProEnabled: boolean
  aiProPlusEnabled: boolean
}

export function MedicalRecordVideoAiActions({
  videoId,
  aiAssistEnabled,
  aiProEnabled,
  aiProPlusEnabled,
}: MedicalRecordVideoAiActionsProps) {
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const runTier = async (tier: Tier) => {
    setLoadingTier(tier)
    setMessage('')
    setError('')

    const path =
      tier === 'assist'
        ? `/api/medical-records/videos/${videoId}/ai-assist`
        : tier === 'pro'
          ? `/api/medical-records/videos/${videoId}/ai-pro`
          : `/api/medical-records/videos/${videoId}/ai-pro-plus`

    try {
      const response = await fetch(path, { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? '動画AI処理の受付に失敗しました。')
      }
      setMessage(payload?.message ?? '動画AI処理を受け付けました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '動画AI処理の受付に失敗しました。')
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {aiAssistEnabled ? (
          <Button
            type="button"
            onClick={() => void runTier('assist')}
            disabled={loadingTier !== null}
            className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500"
          >
            {loadingTier === 'assist' ? 'Assist処理中...' : 'Assist動画処理'}
          </Button>
        ) : null}
        {aiProEnabled ? (
          <Button
            type="button"
            onClick={() => void runTier('pro')}
            disabled={loadingTier !== null}
            className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500"
          >
            {loadingTier === 'pro' ? 'Pro処理中...' : 'Pro動画解析'}
          </Button>
        ) : null}
        {aiProPlusEnabled ? (
          <Button
            type="button"
            onClick={() => void runTier('pro_plus')}
            disabled={loadingTier !== null}
            className="px-2 py-1 text-xs bg-rose-600 hover:bg-rose-500"
          >
            {loadingTier === 'pro_plus' ? 'Pro+処理中...' : 'Pro+動画AI'}
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
