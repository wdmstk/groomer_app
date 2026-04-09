'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type MedicalRecordAiProAnalyzeButtonProps = {
  recordId: string
}

export function MedicalRecordAiProAnalyzeButton({ recordId }: MedicalRecordAiProAnalyzeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`/api/medical-records/${recordId}/ai-pro`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'AI Pro解析に失敗しました。')
      }
      setMessage('AI Pro提案を更新しました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI Pro解析に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        className="h-7 whitespace-nowrap bg-indigo-600 px-2 py-0 text-xs hover:bg-indigo-500"
      >
        {loading ? '解析中...' : 'AI Pro解析'}
      </Button>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-700">{message}</p>
      ) : null}
    </div>
  )
}
