'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { renderNextVisitSuggestionLineTemplate } from '@/lib/notification-templates'
import type { JsonObject } from '@/lib/object-utils'

type RelationValue = {
  full_name?: string | null
  phone_number?: string | null
  line_id?: string | null
  name?: string | null
}

type CandidateRow = {
  customerId: string
  customerName: string
  phoneNumber: string | null
  lineId: string | null
  petId: string | null
  sourceAppointmentId: string | null
  suggestedAssignedUserId: string | null
  suggestedAssignedName: string | null
  lastVisitAt: string
  recommendedAt: string
  recommendationReason: string
  overdueDays: number
}

type FollowupTaskRow = {
  id: string
  customer_id: string
  pet_id: string | null
  source_appointment_id: string | null
  last_visit_at: string
  recommended_at: string
  status: string
  due_on: string | null
  snoozed_until: string | null
  assigned_user_id?: string | null
  resolution_note: string | null
  recommendation_reason?: string | null
  last_contacted_at: string | null
  last_contact_method: string | null
  assignee_name?: string | null
  events?: Array<{
    id: string
    actor_user_id: string | null
    actor_name?: string | null
    event_type: string
    payload: JsonObject
    created_at: string
  }>
  customers?: RelationValue | RelationValue[] | null
  pets?: RelationValue | RelationValue[] | null
}

type FollowupResponse = {
  tasks: FollowupTaskRow[]
  candidates: Array<{
    customer_id: string
    customer_name: string
    phone_number: string | null
    line_id: string | null
    pet_id: string | null
    source_appointment_id: string | null
    suggested_assigned_user_id: string | null
    suggested_assigned_name: string | null
    last_visit_at: string
    recommended_at: string
    recommendation_reason: string
    overdue_days: number
  }>
  assignees?: Array<{
    user_id: string
    full_name: string
  }>
  templates?: {
    next_visit_suggestion_line?: {
      body: string
    }
  }
}

const followupResponseCache = new Map<string, FollowupResponse>()
const inflightFollowupRequests = new Map<string, Promise<FollowupResponse>>()

async function fetchFollowupResponse(searchParams: URLSearchParams) {
  const key = searchParams.toString()
  const cached = followupResponseCache.get(key)
  if (cached) {
    return cached
  }

  const inflight = inflightFollowupRequests.get(key)
  if (inflight) {
    return inflight
  }

  const request = fetch(`/api/followups?${key}`, {
    method: 'GET',
    cache: 'no-store',
  }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as FollowupResponse | { message?: string } | null
    if (!response.ok || !payload || !('tasks' in payload)) {
      throw new Error((payload as { message?: string } | null)?.message ?? 'フォローアップ取得に失敗しました。')
    }
    const data = payload as FollowupResponse
    followupResponseCache.set(key, data)
    return data
  }).finally(() => {
    inflightFollowupRequests.delete(key)
  })

  inflightFollowupRequests.set(key, request)
  return request
}

function clearFollowupResponseCache() {
  followupResponseCache.clear()
  inflightFollowupRequests.clear()
}

function toJstDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getRelationValue(relation: RelationValue | RelationValue[] | null | undefined, key: keyof RelationValue) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.[key] ?? null
  return relation[key] ?? null
}

function formatEventLabel(event: {
  event_type: string
  actor_name?: string | null
  payload: JsonObject
}) {
  const actor = event.actor_name ? ` / ${event.actor_name}` : ''
  const note =
    typeof event.payload.resolution_note === 'string'
      ? event.payload.resolution_note
      : typeof event.payload.note === 'string'
        ? event.payload.note
        : typeof event.payload.action === 'string'
          ? event.payload.action
          : ''

  switch (event.event_type) {
    case 'task_created':
      return `起票${actor}${note ? ` / ${note}` : ''}`
    case 'status_changed':
      return `状態更新${actor}${note ? ` / ${note}` : ''}`
    case 'contacted_phone':
      return `電話対応${actor}`
    case 'contacted_line':
      return `LINE対応${actor}`
    case 'snoozed':
      return `保留${actor}${note ? ` / ${note}` : ''}`
    case 'resolved':
      return `完了${actor}${note ? ` / ${note}` : ''}`
    case 'appointment_created':
      return `予約作成${actor}`
    case 'note_added':
      return `メモ${actor}${note ? ` / ${note}` : ''}`
    default:
      return `${event.event_type}${actor}${note ? ` / ${note}` : ''}`
  }
}

export function RevisitAlertList() {
  const [tasks, setTasks] = useState<FollowupTaskRow[]>([])
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [windowFilter, setWindowFilter] = useState('all')
  const [availableAssignees, setAvailableAssignees] = useState<Array<{ user_id: string; full_name: string }>>([])
  const [followupTemplateBody, setFollowupTemplateBody] = useState('')
  const [actionModal, setActionModal] = useState<{
    taskId: string
    title: string
    status: 'snoozed' | 'resolved_no_need' | 'resolved_lost'
    resolutionType?: string
  } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const searchParams = new URLSearchParams()
      searchParams.set('include_candidates', 'true')
      if (statusFilter !== 'all') {
        searchParams.set('status', statusFilter)
      }
      if (assigneeFilter !== 'all') {
        searchParams.set('assignee', assigneeFilter)
      }
      if (dueFilter !== 'all') {
        searchParams.set('due', dueFilter)
      }
      if (windowFilter !== 'all') {
        searchParams.set('window_days', windowFilter)
      }
      const data = await fetchFollowupResponse(searchParams)
      const nextCandidates = (data.candidates ?? []).map((row) => ({
        customerId: row.customer_id,
        customerName: row.customer_name,
        phoneNumber: row.phone_number,
        lineId: row.line_id,
        petId: row.pet_id,
        sourceAppointmentId: row.source_appointment_id,
        suggestedAssignedUserId: row.suggested_assigned_user_id,
        suggestedAssignedName: row.suggested_assigned_name,
        lastVisitAt: row.last_visit_at,
        recommendedAt: row.recommended_at,
        recommendationReason: row.recommendation_reason,
        overdueDays: row.overdue_days,
      }))

      setTasks(data.tasks ?? [])
      setCandidates(nextCandidates)
      setAvailableAssignees(data.assignees ?? [])
      setFollowupTemplateBody(data.templates?.next_visit_suggestion_line?.body ?? '')
      setSelectedIds(nextCandidates.map((row) => row.customerId))
    } catch (error) {
      setError(error instanceof Error ? error.message : '通信エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }, [assigneeFilter, dueFilter, statusFilter, windowFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedRows = useMemo(
    () => candidates.filter((row) => selectedIds.includes(row.customerId)),
    [candidates, selectedIds]
  )

  const setAllSelection = (checked: boolean) => {
    setSelectedIds(checked ? candidates.map((row) => row.customerId) : [])
  }

  const toggleSelection = (customerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    )
  }

  const toggleEventExpansion = (taskId: string) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    )
  }

  const copyText = async (text: string, doneMessage: string) => {
    if (!text.trim()) {
      setMessage('コピー対象がありません。')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setMessage(doneMessage)
    } catch {
      setError('コピーに失敗しました。')
    }
  }

  const copyFollowupMessage = async () => {
    const text = selectedRows
      .map((row) =>
        renderNextVisitSuggestionLineTemplate({
          customerName: row.customerName,
          petName: 'ペット',
          lastVisitAt: row.lastVisitAt,
          recommendedAt: row.recommendedAt,
          recommendationReason: row.recommendationReason,
          templateBody: followupTemplateBody || undefined,
        })
      )
      .join('\n\n')
    await copyText(text, `連絡文をコピーしました（${selectedRows.length}件）`)
  }

  const copySingleFollowupMessage = async (row: {
    customerName: string
    lastVisitAt: string
    recommendedAt: string
    recommendationReason: string
  }) => {
    const text = renderNextVisitSuggestionLineTemplate({
      customerName: row.customerName,
      petName: 'ペット',
      lastVisitAt: row.lastVisitAt,
      recommendedAt: row.recommendedAt,
      recommendationReason: row.recommendationReason,
      templateBody: followupTemplateBody || undefined,
    })
    await copyText(text, `${row.customerName}様向け連絡文をコピーしました。`)
  }

  const copyPhoneList = async () => {
    const text = selectedRows
      .filter((row) => row.phoneNumber)
      .map((row) => `${row.customerName}: ${row.phoneNumber}`)
      .join('\n')
    await copyText(text, '電話番号一覧をコピーしました。')
  }

  const copyLineList = async () => {
    const text = selectedRows
      .filter((row) => row.lineId)
      .map((row) => `${row.customerName}: ${row.lineId}`)
      .join('\n')
    await copyText(text, 'LINE ID一覧をコピーしました。')
  }

  const createTask = async (row: CandidateRow) => {
    setSavingId(row.customerId)
    setError('')
    try {
      const response = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: row.customerId,
          pet_id: row.petId,
          source_appointment_id: row.sourceAppointmentId,
          last_visit_at: row.lastVisitAt,
          recommended_at: row.recommendedAt,
          assigned_user_id: row.suggestedAssignedUserId,
          priority: row.overdueDays >= 14 ? 'high' : 'normal',
          due_on: row.recommendedAt.slice(0, 10),
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? 'フォローアップ作成に失敗しました。')
        return
      }
      setMessage(`${row.customerName}様をフォローアップキューに追加しました。`)
      clearFollowupResponseCache()
      await loadData()
    } catch {
      setError('フォローアップ作成中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const updateTaskStatus = async (
    taskId: string,
    nextStatus: string,
    options?: { resolution_type?: string; resolution_note?: string; snoozed_until?: string }
  ) => {
    setSavingId(taskId)
    setError('')
    try {
      const response = await fetch(`/api/followups/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          ...options,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? 'ステータス更新に失敗しました。')
        return
      }
      setMessage('フォローアップ状態を更新しました。')
      clearFollowupResponseCache()
      await loadData()
    } catch {
      setError('ステータス更新中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const updateTaskAssignee = async (taskId: string, assignedUserId: string) => {
    setSavingId(taskId)
    setError('')
    try {
      const response = await fetch(`/api/followups/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_user_id: assignedUserId || null,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '担当者更新に失敗しました。')
        return
      }

      setMessage('担当者を更新しました。')
      clearFollowupResponseCache()
      await loadData()
    } catch {
      setError('担当者更新中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const recordContact = async (
    taskId: string,
    eventType: 'contacted_phone' | 'contacted_line',
    options?: { body?: string; subject?: string | null }
  ) => {
    setSavingId(taskId)
    setError('')
    try {
      const response = await fetch(`/api/followups/${taskId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          payload: {
            channel: eventType === 'contacted_phone' ? 'phone' : 'line',
            body: options?.body ?? null,
            subject: options?.subject ?? null,
            notification_type: 'followup',
          },
        }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(payload?.message ?? '対応履歴の記録に失敗しました。')
        return
      }
      setMessage('対応履歴を記録しました。')
      clearFollowupResponseCache()
      await loadData()
    } catch {
      setError('対応履歴の記録中に通信エラーが発生しました。')
    } finally {
      setSavingId(null)
    }
  }

  const openActionModal = (
    taskId: string,
    title: string,
    status: 'snoozed' | 'resolved_no_need' | 'resolved_lost',
    resolutionType?: string
  ) => {
    setActionModal({ taskId, title, status, resolutionType })
    setActionReason('')
  }

  const submitActionModal = async () => {
    if (!actionModal) return

    if (actionModal.status === 'snoozed') {
      await updateTaskStatus(actionModal.taskId, 'snoozed', {
        snoozed_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        resolution_note: actionReason.trim() || '1週間保留',
      })
    } else if (actionModal.status === 'resolved_no_need') {
      await updateTaskStatus(actionModal.taskId, 'resolved_no_need', {
        resolution_type: actionModal.resolutionType ?? 'no_need',
        resolution_note: actionReason.trim() || '対応不要としてクローズ',
      })
    } else if (actionModal.status === 'resolved_lost') {
      await updateTaskStatus(actionModal.taskId, 'resolved_lost', {
        resolution_type: actionModal.resolutionType ?? 'declined',
        resolution_note: actionReason.trim() || '失注としてクローズ',
      })
    }

    setActionModal(null)
    setActionReason('')
  }

  const taskRows = tasks.map((task) => ({
    id: task.id,
    customerId: task.customer_id,
    petId: task.pet_id,
    customerName: getRelationValue(task.customers, 'full_name') ?? '未登録',
    phoneNumber: getRelationValue(task.customers, 'phone_number'),
    lineId: getRelationValue(task.customers, 'line_id'),
    petName: getRelationValue(task.pets, 'name'),
    lastVisitAt: task.last_visit_at,
    recommendedAt: task.recommended_at,
    recommendation_reason: task.recommendation_reason ?? null,
    overdueDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(task.recommended_at).getTime()) / (24 * 60 * 60 * 1000))
    ),
    sourceAppointmentId: task.source_appointment_id,
    status: task.status,
    dueOn: task.due_on,
    snoozedUntil: task.snoozed_until,
    assignedUserId: task.assigned_user_id ?? '',
    resolutionNote: task.resolution_note,
    lastContactedAt: task.last_contacted_at,
    lastContactMethod: task.last_contact_method,
    assigneeName: task.assignee_name ?? null,
    events: task.events ?? [],
  }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">再来店フォロー隊列</h2>
          <p className="text-xs text-gray-500">候補抽出ではなく、対応キューとして運用します。</p>
        </div>
        <Button type="button" className="bg-gray-700 hover:bg-gray-800" onClick={() => void loadData()}>
          再読込
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border bg-white p-3">
        <label className="space-y-1 text-sm text-gray-700">
          <span className="block text-xs text-gray-500">状態</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="open">未着手</option>
            <option value="in_progress">対応中</option>
            <option value="snoozed">保留</option>
            <option value="resolved_booked">予約化</option>
            <option value="resolved_no_need">不要</option>
            <option value="resolved_lost">失注</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-gray-700">
          <span className="block text-xs text-gray-500">担当者</span>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="me">自分</option>
            {availableAssignees.map((assignee) => (
              <option key={assignee.user_id} value={assignee.user_id}>
                {assignee.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-gray-700">
          <span className="block text-xs text-gray-500">期限</span>
          <select
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="today">今日</option>
            <option value="overdue">期限超過</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-gray-700">
          <span className="block text-xs text-gray-500">対象期間</span>
          <select
            value={windowFilter}
            onChange={(event) => setWindowFilter(event.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="all">全期間</option>
            <option value="7">直近7日</option>
            <option value="30">直近30日</option>
          </select>
        </label>
      </div>

      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-gray-500">
        表示期間: {windowFilter === 'all' ? '全期間' : `直近${windowFilter}日`}
      </p>
      {loading ? <p className="text-sm text-gray-500">読み込み中...</p> : null}

      {!loading ? (
        <>
          <div className="space-y-3 rounded border bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">未着手候補</h3>
                <p className="text-xs text-gray-500">未対応タスクがない顧客のみ表示。キュー投入時に担当を引き継ぎます。</p>
              </div>
              <p className="text-xs text-gray-500">{candidates.length} 件</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={candidates.length > 0 && selectedIds.length === candidates.length}
                  onChange={(event) => setAllSelection(event.target.checked)}
                />
                全選択
              </label>
              <Button type="button" onClick={copyFollowupMessage}>
                一括連絡文をコピー
              </Button>
              <Button type="button" className="bg-gray-700 hover:bg-gray-800" onClick={copyPhoneList}>
                電話一覧をコピー
              </Button>
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={copyLineList}>
                LINE一覧をコピー
              </Button>
            </div>

            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500">新規候補はありません。</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="px-2 py-2">選択</th>
                      <th className="px-2 py-2">顧客</th>
                      <th className="px-2 py-2">ペット</th>
                      <th className="px-2 py-2">前回来店</th>
                      <th className="px-2 py-2">推奨来店日</th>
                      <th className="px-2 py-2">算出根拠</th>
                      <th className="px-2 py-2">超過日数</th>
                      <th className="px-2 py-2">担当引継ぎ</th>
                      <th className="px-2 py-2">電話</th>
                      <th className="px-2 py-2">LINE</th>
                      <th className="px-2 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {candidates.map((row) => (
                      <tr key={row.customerId} className="text-gray-700">
                        <td className="px-2 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.customerId)}
                            onChange={() => toggleSelection(row.customerId)}
                          />
                        </td>
                        <td className="px-2 py-3 font-medium text-gray-900">{row.customerName}</td>
                        <td className="px-2 py-3">{row.petId ? '引継ぎあり' : '未特定'}</td>
                        <td className="px-2 py-3">{toJstDateLabel(row.lastVisitAt)}</td>
                        <td className="px-2 py-3">{toJstDateLabel(row.recommendedAt)}</td>
                        <td className="px-2 py-3 text-xs text-gray-500">{row.recommendationReason}</td>
                        <td className="px-2 py-3">{row.overdueDays} 日</td>
                        <td className="px-2 py-3">{row.suggestedAssignedName ?? '未割当'}</td>
                        <td className="px-2 py-3">{row.phoneNumber ?? '未登録'}</td>
                        <td className="px-2 py-3">{row.lineId ?? '未登録'}</td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => void createTask(row)}
                              disabled={savingId === row.customerId}
                            >
                              キューに追加
                            </Button>
                            {row.phoneNumber ? (
                              <a
                                href={`tel:${row.phoneNumber}`}
                                className="rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white"
                              >
                                電話する
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                void copySingleFollowupMessage(row)
                              }}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                            >
                              LINE文面コピー
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded border bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">対応キュー</h3>
                <p className="text-xs text-gray-500">保留、不要、予約化までここで閉じます。</p>
              </div>
              <p className="text-xs text-gray-500">{taskRows.length} 件</p>
            </div>

            {taskRows.length === 0 ? (
              <p className="text-sm text-gray-500">フォローアップタスクはまだありません。</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="px-2 py-2">顧客</th>
                      <th className="px-2 py-2">ペット</th>
                      <th className="px-2 py-2">前回来店</th>
                      <th className="px-2 py-2">推奨来店日</th>
                      <th className="px-2 py-2">担当者</th>
                      <th className="px-2 py-2">状態</th>
                      <th className="px-2 py-2">連絡</th>
                      <th className="px-2 py-2">メモ</th>
                      <th className="px-2 py-2">履歴</th>
                      <th className="px-2 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {taskRows.map((task) => {
                      const isResolved = task.status.startsWith('resolved_')
                      return (
                      <tr key={task.id} className="text-gray-700">
                        <td className="px-2 py-3 font-medium text-gray-900">
                          {task.customerName}
                          <p className="text-xs text-gray-500">{task.overdueDays} 日超過</p>
                        </td>
                        <td className="px-2 py-3">{task.petName ?? '未登録'}</td>
                        <td className="px-2 py-3">{toJstDateLabel(task.lastVisitAt)}</td>
                        <td className="px-2 py-3">{toJstDateLabel(task.recommendedAt)}</td>
                        <td className="px-2 py-3">{task.assigneeName ?? '未割当'}</td>
                        <td className="px-2 py-3">
                          <p>{task.status}</p>
                          {task.snoozedUntil ? (
                            <p className="text-xs text-gray-500">再通知: {toJstDateLabel(task.snoozedUntil)}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">
                          <p>電話: {task.phoneNumber ?? '未登録'}</p>
                          <p>LINE: {task.lineId ?? '未登録'}</p>
                          {task.lastContactedAt ? (
                            <p className="text-xs text-gray-500">
                              最終対応: {toJstDateLabel(task.lastContactedAt)} / {task.lastContactMethod ?? 'manual'}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">{task.resolutionNote ?? 'なし'}</td>
                        <td className="px-2 py-3">
                          {task.events.length > 0 ? (
                            <div className="space-y-1 text-xs text-gray-600">
                              {(expandedTaskIds.includes(task.id) ? task.events : task.events.slice(0, 3)).map(
                                (event) => (
                                  <p key={event.id}>
                                    {toJstDateLabel(event.created_at)} / {formatEventLabel(event)}
                                  </p>
                                )
                              )}
                              {task.events.length > 3 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleEventExpansion(task.id)}
                                  className="text-xs font-semibold text-blue-700"
                                >
                                  {expandedTaskIds.includes(task.id) ? '閉じる' : 'もっと見る'}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">履歴なし</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={task.assignedUserId}
                              onChange={(event) => {
                                void updateTaskAssignee(task.id, event.target.value)
                              }}
                              className="rounded border p-1 text-xs"
                              disabled={savingId === task.id || isResolved}
                            >
                              <option value="">担当未設定</option>
                              {availableAssignees.map((assignee) => (
                                <option key={assignee.user_id} value={assignee.user_id}>
                                  {assignee.full_name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              className="bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => void updateTaskStatus(task.id, 'in_progress')}
                              disabled={savingId === task.id || task.status === 'in_progress' || isResolved}
                            >
                              対応中
                            </Button>
                            <Button
                              type="button"
                              className="bg-gray-700 hover:bg-gray-800"
                              onClick={() => openActionModal(task.id, '保留理由', 'snoozed')}
                              disabled={savingId === task.id || isResolved}
                            >
                              1週間保留
                            </Button>
                            <Button
                              type="button"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() =>
                                openActionModal(task.id, '不要理由', 'resolved_no_need', 'no_need')
                              }
                              disabled={savingId === task.id || isResolved}
                            >
                              不要
                            </Button>
                            <Button
                              type="button"
                              className="bg-rose-600 hover:bg-rose-700"
                              onClick={() =>
                                openActionModal(task.id, '失注理由', 'resolved_lost', 'declined')
                              }
                              disabled={savingId === task.id || isResolved}
                            >
                              失注
                            </Button>
                            {!isResolved && task.phoneNumber ? (
                              <a
                                href={`tel:${task.phoneNumber}`}
                                onClick={() => {
                                  void recordContact(task.id, 'contacted_phone')
                                }}
                                className="rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white"
                              >
                                電話
                              </a>
                            ) : null}
                            {!isResolved && task.lineId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const body = renderNextVisitSuggestionLineTemplate({
                                    customerName: task.customerName,
                                    petName: task.petName ?? 'ペット',
                                    lastVisitAt: task.lastVisitAt,
                                    recommendedAt: task.recommendedAt,
                                    recommendationReason:
                                      typeof task.recommendation_reason === 'string'
                                        ? task.recommendation_reason
                                        : '前回施術内容からおすすめ時期を算出',
                                    templateBody: followupTemplateBody || undefined,
                                  })
                                  void copyText(body, `${task.customerName}様向け連絡文をコピーしました。`)
                                  void recordContact(task.id, 'contacted_line', {
                                    body,
                                    subject: '再来店フォロー',
                                  })
                                }}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                              >
                                LINE送信
                              </button>
                            ) : null}
                            {task.status.startsWith('resolved_') ? (
                              <span className="text-xs font-semibold text-gray-500">解決済み</span>
                            ) : null}
                            <Link
                              href={`/appointments?tab=list&modal=create${task.sourceAppointmentId ? `&followup_from=${task.sourceAppointmentId}` : ''}&followup_task_id=${task.id}&followup_customer_id=${task.customerId}${task.petId ? `&followup_pet_id=${task.petId}` : ''}`}
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                            >
                              予約作成
                            </Link>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {actionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{actionModal.title}</h3>
              <button
                type="button"
                onClick={() => {
                  setActionModal(null)
                  setActionReason('')
                }}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
            <div className="space-y-3">
              <label className="block space-y-2 text-sm text-gray-700">
                <span>内容</span>
                <textarea
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  rows={4}
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="理由やメモを入力"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => void submitActionModal()} disabled={Boolean(savingId)}>
                  保存する
                </Button>
                <Button
                  type="button"
                  className="bg-gray-700 hover:bg-gray-800"
                  onClick={() => {
                    setActionModal(null)
                    setActionReason('')
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
