'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'

export default function SetupStorePage() {
  const router = useRouter()
  const [storeName, setStoreName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const trimmed = storeName.trim()
    if (!trimmed) {
      setError('店舗名を入力してください。')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stores/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: trimmed }),
      })

      const json = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        setError(json.message ?? '店舗作成に失敗しました。')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="w-full max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">新しい店舗を追加</h1>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label htmlFor="storeName" className="text-sm font-medium text-gray-700">
              店舗名
            </label>
            <input
              id="storeName"
              type="text"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              maxLength={120}
              className="w-full rounded border p-2"
              placeholder="例: 渋谷店"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isSubmitting ? '作成中...' : '店舗を作成'}
          </button>
        </form>
      </Card>
    </section>
  )
}
