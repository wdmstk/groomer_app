'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type JournalVisibilityToggleButtonProps = {
  entryId: string
  isPublic: boolean
}

export function JournalVisibilityToggleButton({
  entryId,
  isPublic,
}: JournalVisibilityToggleButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleToggle() {
    setLoading(true)
    setError('')
    try {
      const targetPublic = !isPublic
      const response = await fetch(`/api/journal/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          targetPublic
            ? {
                status: 'published',
                visibility: 'owner',
              }
            : {
                visibility: 'internal',
              }
        ),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '公開状態の更新に失敗しました。')
      }
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '公開状態の更新に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1 text-right">
      <Button
        type="button"
        onClick={() => {
          void handleToggle()
        }}
        disabled={loading}
        className={isPublic ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}
      >
        {loading ? '更新中...' : isPublic ? '非公開' : '公開'}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
