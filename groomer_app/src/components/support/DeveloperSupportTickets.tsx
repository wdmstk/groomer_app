'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { JsonObject } from '@/lib/object-utils'

type ThreadRow = {
  store_id: string
  store_name: string
  is_active: boolean
  open_ticket_count: number
  last_ticket_subject: string | null
  last_activity_at: string | null
}

type TicketRow = {
  id: string
  ticket_no: number
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  last_activity_at: string
  events?: Array<{
    id: string
    event_type: string
    payload: JsonObject
    created_at: string
  }>
}

const STATUS_LABELS: Record<string, string> = {
  open: '未対応',
  in_progress: '対応中',
  waiting_user: 'ユーザー確認待ち',
  resolved: '解決済み',
  closed: '完了',
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '一般',
  bug: '不具合',
  billing: '課金',
  feature_request: '機能要望',
  account: 'アカウント',
  data_fix: 'データ補正依頼',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '通常',
  high: '高',
  urgent: '緊急',
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getActorLabel(payload: JsonObject) {
  const actorScope = typeof payload.actor_scope === 'string' ? payload.actor_scope : ''
  const actorRole = typeof payload.actor_role === 'string' ? payload.actor_role : ''
  if (actorScope === 'developer') return '開発側'
  if (actorRole === 'owner') return 'オーナー'
  if (actorRole === 'admin') return '管理者'
  if (actorRole === 'staff') return 'スタッフ'
  return ''
}

export function DeveloperSupportTickets() {
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [commentByTicketId, setCommentByTicketId] = useState<Record<string, string>>({})

  useEffect(() => {
    let mounted = true
    async function loadThreads() {
      const response = await fetch('/api/dev/support-tickets/threads', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as { threads?: ThreadRow[]; message?: string } | null
      if (!response.ok) {
        if (mounted) setError(payload?.message ?? 'スレッド取得に失敗しました。')
        return
      }
      if (!mounted) return
      const rows = payload?.threads ?? []
      setThreads(rows)
      if (rows[0]?.store_id) {
        setSelectedStoreId(rows[0].store_id)
      }
    }
    void loadThreads()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedStoreId) return
    let mounted = true
    async function loadTickets() {
      const response = await fetch(`/api/dev/support-tickets?store_id=${encodeURIComponent(selectedStoreId)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as { tickets?: TicketRow[]; message?: string } | null
      if (!response.ok) {
        if (mounted) setError(payload?.message ?? 'チケット取得に失敗しました。')
        return
      }
      if (!mounted) return
      setTickets(payload?.tickets ?? [])
    }
    void loadTickets()
    return () => {
      mounted = false
    }
  }, [selectedStoreId])

  async function updateTicket(ticketId: string, body: { [key: string]: unknown }) {
    if (!selectedStoreId) return
    const response = await fetch('/api/dev/support-tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: selectedStoreId,
        ticket_id: ticketId,
        ...body,
      }),
    })
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    if (!response.ok) {
      setError(payload?.message ?? 'チケット更新に失敗しました。')
      return
    }
    setMessage('チケットを更新しました。')
    const reload = await fetch(`/api/dev/support-tickets?store_id=${encodeURIComponent(selectedStoreId)}`, {
      cache: 'no-store',
    })
    const reloadPayload = (await reload.json().catch(() => null)) as { tickets?: TicketRow[] } | null
    setTickets(reloadPayload?.tickets ?? [])
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">サポートチケット（開発者）</h1>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <label className="block text-sm text-gray-700">
          店舗
          <select
            value={selectedStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            {threads.map((row) => (
              <option key={row.store_id} value={row.store_id}>
                {row.store_name}（open: {row.open_ticket_count}）
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">チケット一覧</h2>
        {tickets.length === 0 ? <p className="text-sm text-gray-500">チケットはありません。</p> : null}
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">
                  #{ticket.ticket_no} {ticket.subject}
                </p>
              <select
                value={ticket.status}
                onChange={(event) => {
                  void updateTicket(ticket.id, { status: event.target.value })
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="open">未対応</option>
                  <option value="in_progress">対応中</option>
                  <option value="waiting_user">ユーザー確認待ち</option>
                  <option value="resolved">解決済み</option>
                  <option value="closed">完了</option>
                </select>
              </div>
              <p className="text-sm text-gray-700">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category} / {PRIORITY_LABELS[ticket.priority] ?? ticket.priority} / {STATUS_LABELS[ticket.status] ?? ticket.status}
              </p>
              <p className="text-xs text-gray-500">
                作成: {formatDateTime(ticket.created_at)} / 最終更新: {formatDateTime(ticket.last_activity_at)}
              </p>
              <div className="mt-2 space-y-1 rounded border bg-gray-50 p-2">
                <p className="text-xs font-semibold text-gray-700">履歴</p>
                {(ticket.events ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">履歴はありません。</p>
                ) : (
                  (ticket.events ?? []).slice(0, 8).map((event) => (
                    <p key={event.id} className="text-xs text-gray-600">
                      {formatDateTime(event.created_at)} / {event.event_type === 'note_added' ? 'comment_added' : event.event_type}
                      {getActorLabel(event.payload) ? ` / ${getActorLabel(event.payload)}` : ''}
                      {typeof event.payload?.comment === 'string'
                        ? ` / ${event.payload.comment}`
                        : typeof event.payload?.note === 'string'
                          ? ` / ${event.payload.note}`
                          : ''}
                    </p>
                  ))
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={commentByTicketId[ticket.id] ?? ''}
                  onChange={(event) =>
                    setCommentByTicketId((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="店舗へ返信コメント"
                />
                <Button
                  className="shrink-0 whitespace-nowrap"
                  type="button"
                  onClick={() => {
                    const comment = (commentByTicketId[ticket.id] ?? '').trim()
                    if (!comment) {
                      setError('コメントを入力してください。')
                      return
                    }
                    setCommentByTicketId((current) => ({ ...current, [ticket.id]: '' }))
                    void updateTicket(ticket.id, { comment })
                  }}
                >
                  送信
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
