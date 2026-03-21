'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type DurationSuggestionRow = {
  id: string
  name: string
  currentDuration: number
  recommendedDuration: number
  sampleCount: number
  delta: number
}

type DurationSuggestionResponse = {
  learningWindowDays: number
  rows: DurationSuggestionRow[]
}

export function DurationSuggestionPanel() {
  const [data, setData] = useState<DurationSuggestionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const response = await fetch('/api/service-menus/duration-suggestions', {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => null)) as
          | DurationSuggestionResponse
          | { message?: string }
          | null

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === 'object' &&
            'message' in payload &&
            typeof payload.message === 'string'
              ? payload.message
              : '推奨候補の取得に失敗しました。'
          throw new Error(message)
        }

        if (mounted) {
          setData({
            learningWindowDays: (payload as DurationSuggestionResponse).learningWindowDays,
            rows: (payload as DurationSuggestionResponse).rows ?? [],
          })
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : '推奨候補の取得に失敗しました。')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  const rows = data?.rows ?? []
  const learningWindowDays = data?.learningWindowDays ?? 60

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between rounded border border-violet-200 bg-violet-50 p-3">
        <div>
          <p className="text-xs text-violet-700">所要時間の自己学習補正（直近{learningWindowDays}日）</p>
          <p className="text-sm font-semibold text-violet-900">
            推奨更新候補 {loading ? '読込中...' : `${rows.length} 件`}
          </p>
        </div>
        <Link href="/appointments?tab=list&modal=create" className="rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white">
          予約作成へ
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">推奨候補を読み込んでいます。</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {rows.slice(0, 5).map((row) => (
            <div key={row.id} className="flex flex-col gap-2 rounded border border-violet-200 bg-violet-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-gray-900">{row.name}</p>
                <p className="text-gray-700">
                  現在 {row.currentDuration} 分 → 推奨 {row.recommendedDuration} 分
                  （差分 {row.delta > 0 ? '+' : ''}{row.delta} 分 / 実績 {row.sampleCount} 件）
                </p>
              </div>
              <Link href={`/service-menus?tab=list&edit=${row.id}`} className="rounded border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700">
                このメニューを編集
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">推奨更新候補はありません（実績5件以上かつ差分10分以上で表示）。</p>
      )}
    </div>
  )
}
