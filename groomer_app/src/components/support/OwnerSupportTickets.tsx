'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { JsonObject } from '@/lib/object-utils'

type TicketRow = {
  id: string
  ticket_no: number
  created_at: string
  last_activity_at: string
  subject: string
  description: string | null
  category: string
  priority: string
  status: string
  events?: Array<{
    id: string
    event_type: string
    payload: JsonObject
    created_at: string
  }>
}

type ApiResponse = {
  tickets?: TicketRow[]
  message?: string
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

function formatDateTime(value: string) {
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

export function OwnerSupportTickets() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'normal',
  })
  const [commentByTicketId, setCommentByTicketId] = useState<Record<string, string>>({})

  async function loadTickets() {
    setLoading(true)
    setError('')
    const response = await fetch('/api/support-tickets', { cache: 'no-store' })
    const payload = (await response.json().catch(() => null)) as ApiResponse | null
    if (!response.ok) {
      setError(payload?.message ?? 'チケットの読み込みに失敗しました。')
      setLoading(false)
      return
    }
    setTickets(payload?.tickets ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialTickets() {
      const response = await fetch('/api/support-tickets', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as ApiResponse | null
      if (cancelled) return
      if (!response.ok) {
        setError(payload?.message ?? 'チケットの読み込みに失敗しました。')
        setLoading(false)
        return
      }
      setTickets(payload?.tickets ?? [])
      setLoading(false)
    }

    void loadInitialTickets()

    return () => {
      cancelled = true
    }
  }, [])

  async function createTicket() {
    setSaving(true)
    setMessage('')
    setError('')
    const response = await fetch('/api/support-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    if (!response.ok) {
      setError(payload?.message ?? 'チケット起票に失敗しました。')
      setSaving(false)
      return
    }
    setForm((current) => ({ ...current, subject: '', description: '' }))
    setMessage('チケットを起票しました。')
    await loadTickets()
    setSaving(false)
  }

  async function addComment(ticketId: string) {
    const comment = (commentByTicketId[ticketId] ?? '').trim()
    if (!comment) {
      setError('コメントを入力してください。')
      return
    }
    const response = await fetch('/api/support-tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId,
        comment,
      }),
    })
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    if (!response.ok) {
      setError(payload?.message ?? 'チケット更新に失敗しました。')
      return
    }
    setCommentByTicketId((current) => ({ ...current, [ticketId]: '' }))
    setMessage('コメントを投稿しました。')
    await loadTickets()
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">問い合わせチケット</h1>
      <Card>
        <div className="space-y-3">
          <label className="block text-sm text-gray-700">
            件名
            <input
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="例: 会計画面でエラーが出る"
            />
          </label>
          <label className="block text-sm text-gray-700">
            詳細
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="再現手順、発生時刻、影響範囲など"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-sm text-gray-700">
              カテゴリ
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="general">一般</option>
                <option value="bug">不具合</option>
                <option value="billing">課金</option>
                <option value="feature_request">機能要望</option>
                <option value="account">アカウント</option>
                <option value="data_fix">データ補正依頼</option>
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              優先度
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="low">低</option>
                <option value="normal">通常</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </label>
          </div>
          <Button type="button" disabled={saving} onClick={() => void createTicket()}>
            チケットを起票
          </Button>
        </div>
      </Card>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">チケット一覧</h2>
        {loading ? <p className="text-sm text-gray-500">読み込み中...</p> : null}
        {!loading && tickets.length === 0 ? <p className="text-sm text-gray-500">チケットはありません。</p> : null}
        {!loading ? (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">
                    #{ticket.ticket_no} {ticket.subject}
                  </p>
                <span className="rounded border border-gray-300 px-2 py-1 text-sm">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
                </div>
                <p className="text-sm text-gray-700">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category} / {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                </p>
                {ticket.description ? <p className="mt-1 text-sm text-gray-700">{ticket.description}</p> : null}
                <p className="mt-1 text-xs text-gray-500">
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
                    placeholder="サポートへの追記コメント"
                  />
                  <Button className="shrink-0 whitespace-nowrap" type="button" onClick={() => void addComment(ticket.id)}>
                    送信
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  )
}
