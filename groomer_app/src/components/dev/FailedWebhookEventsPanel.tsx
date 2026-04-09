'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type FailedWebhookEventRow = {
  id: string
  created_at: string
  store_id: string | null
  provider: 'stripe' | 'komoju'
  event_type: string
  event_id: string | null
  status: 'failed'
  error_message: string | null
  stores?: { name: string | null } | { name: string | null }[] | null
}

type FailedWebhookEventsPanelProps = {
  events: FailedWebhookEventRow[]
}

function resolveStoreName(stores: FailedWebhookEventRow['stores']) {
  if (!stores) return '店舗不明'
  if (Array.isArray(stores)) return stores[0]?.name ?? '店舗不明'
  return stores.name ?? '店舗不明'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function FailedWebhookEventsPanel({ events }: FailedWebhookEventsPanelProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function retryWebhook(webhookEventId: string) {
    setProcessingId(webhookEventId)
    setMessage('')
    try {
      const response = await fetch('/api/admin/billing/webhook-events/retry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ webhookEventId }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '再処理に失敗しました。')
      }
      setMessage('再処理を実行しました。最新状態に更新します。')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '再処理に失敗しました。')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900">Webhook失敗イベント再処理</h2>
      {message ? <p className="mt-2 text-sm text-gray-700">{message}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full table-fixed text-sm text-left">
          <thead className="border-b bg-gray-50 text-gray-500">
            <tr>
              <th className="px-2.5 py-2">日時</th>
              <th className="px-2.5 py-2">店舗</th>
              <th className="px-2.5 py-2">provider</th>
              <th className="px-2.5 py-2">event_type</th>
              <th className="px-2.5 py-2">event_id</th>
              <th className="px-2.5 py-2">webhook_event_id</th>
              <th className="px-2.5 py-2">error</th>
              <th className="px-2.5 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((row) => (
              <tr key={row.id} className="bg-red-50 text-gray-700">
                <td className="px-2.5 py-2">{formatDate(row.created_at)}</td>
                <td className="px-2.5 py-2">{resolveStoreName(row.stores)}</td>
                <td className="px-2.5 py-2">{row.provider}</td>
                <td className="px-2.5 py-2">{row.event_type}</td>
                <td className="px-2.5 py-2">{row.event_id ?? '-'}</td>
                <td className="px-2.5 py-2 font-mono text-xs">{row.id}</td>
                <td className="px-2.5 py-2">{row.error_message ?? '-'}</td>
                <td className="px-2.5 py-2">
                  <Button
                    type="button"
                    onClick={() => retryWebhook(row.id)}
                    disabled={processingId === row.id}
                  >
                    {processingId === row.id ? '実行中...' : '再処理'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
