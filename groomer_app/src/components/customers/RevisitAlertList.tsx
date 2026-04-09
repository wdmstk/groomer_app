'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
  resolved_at?: string | null
  updated_at?: string | null
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

function getTaskStatusLabel(status: string) {
  switch (status) {
    case 'open':
      return '未着手'
    case 'in_progress':
      return '対応中'
    case 'snoozed':
      return '保留'
    case 'resolved_booked':
      return '予約化'
    case 'resolved_no_need':
      return '不要'
    case 'resolved_lost':
      return '失注'
    default:
      return status
  }
}

function getTaskStatusTone(status: string) {
  if (status === 'open') return 'bg-rose-100 text-rose-800'
  if (status === 'in_progress') return 'bg-amber-100 text-amber-800'
  if (status === 'snoozed') return 'bg-slate-100 text-slate-700'
  if (status === 'resolved_booked') return 'bg-emerald-100 text-emerald-800'
  if (status === 'resolved_no_need' || status === 'resolved_lost') return 'bg-gray-100 text-gray-700'
  return 'bg-gray-100 text-gray-700'
}

function getOverdueTone(overdueDays: number) {
  if (overdueDays >= 14) return 'bg-rose-100 text-rose-800'
  if (overdueDays >= 7) return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
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
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<string[]>([])
  const [expandedQueueRowIds, setExpandedQueueRowIds] = useState<string[]>([])

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
    setSelectedIds(checked ? visibleCandidates.map((row) => row.customerId) : [])
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

  const toggleCandidateExpansion = (customerId: string) => {
    setExpandedCandidateIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    )
  }

  const toggleQueueRowExpansion = (taskId: string) => {
    setExpandedQueueRowIds((prev) =>
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
    const text = selectedRowsForVisibleCandidates
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
    await copyText(text, `連絡文をコピーしました（${selectedRowsForVisibleCandidates.length}件）`)
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
    const text = selectedRowsForVisibleCandidates
      .filter((row) => row.phoneNumber)
      .map((row) => `${row.customerName}: ${row.phoneNumber}`)
      .join('\n')
    await copyText(text, '電話番号一覧をコピーしました。')
  }

  const copyLineList = async () => {
    const text = selectedRowsForVisibleCandidates
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
    resolvedAt: task.resolved_at ?? null,
    updatedAt: task.updated_at ?? null,
    dueOn: task.due_on,
    snoozedUntil: task.snoozed_until,
    assignedUserId: task.assigned_user_id ?? '',
    resolutionNote: task.resolution_note,
    lastContactedAt: task.last_contacted_at,
    lastContactMethod: task.last_contact_method,
    assigneeName: task.assignee_name ?? null,
    events: task.events ?? [],
  }))
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays
    return new Date(a.recommendedAt).getTime() - new Date(b.recommendedAt).getTime()
  })
  const sortedTaskRows = [...taskRows].sort((a, b) => {
    const aResolved = a.status.startsWith('resolved_') ? 1 : 0
    const bResolved = b.status.startsWith('resolved_') ? 1 : 0
    if (aResolved !== bResolved) return aResolved - bResolved
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays
    return new Date(a.recommendedAt).getTime() - new Date(b.recommendedAt).getTime()
  })
  const unresolvedTaskCustomerIdSet = new Set(
    sortedTaskRows.filter((task) => !task.status.startsWith('resolved_')).map((task) => task.customerId)
  )
  const visibleCandidates = sortedCandidates.filter((row) => !unresolvedTaskCustomerIdSet.has(row.customerId))
  const visibleCandidateIdSet = new Set(visibleCandidates.map((row) => row.customerId))
  const selectedRowsForVisibleCandidates = selectedRows.filter((row) => visibleCandidateIdSet.has(row.customerId))
  const selectedVisibleCount = selectedIds.filter((id) => visibleCandidateIdSet.has(id)).length
  const inProgressTaskRows = sortedTaskRows.filter((task) => !task.status.startsWith('resolved_'))
  const resolvedTaskRows = sortedTaskRows.filter(
    (task) => task.status.startsWith('resolved_') && !visibleCandidateIdSet.has(task.customerId)
  )

  const renderTaskSection = (
    title: string,
    description: string,
    rows: typeof sortedTaskRows,
    emptyText: string,
    readOnly = false
  ) => (
    <div className="space-y-3 rounded border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <p className="text-xs text-gray-500">{rows.length} 件</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2.5 py-2">顧客</th>
                <th className="px-2.5 py-2">超過日数</th>
                <th className="px-2.5 py-2">担当者</th>
                <th className="px-2.5 py-2">状態</th>
                <th className="px-2.5 py-2">操作</th>
                <th className="px-2.5 py-2">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((task) => {
                const isResolved = task.status.startsWith('resolved_')
                const isExpanded = expandedQueueRowIds.includes(task.id)
                return (
                  <Fragment key={task.id}>
                    <tr className="text-gray-700">
                      <td className="px-2.5 py-2 font-medium text-gray-900">{task.customerName}</td>
                      <td className="px-2.5 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getOverdueTone(task.overdueDays)}`}
                        >
                          {task.overdueDays} 日
                        </span>
                      </td>
                      <td className="px-2.5 py-2">{task.assigneeName ?? '未割当'}</td>
                      <td className="px-2.5 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getTaskStatusTone(task.status)}`}
                        >
                          {getTaskStatusLabel(task.status)}
                        </span>
                        {task.snoozedUntil ? (
                          <p className="mt-1 text-xs text-gray-500">再通知: {toJstDateLabel(task.snoozedUntil)}</p>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2">
                        {readOnly ? (
                          <span className="text-xs font-semibold text-gray-500">解決済み</span>
                        ) : (
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
                            {task.status === 'in_progress' ? (
                              <span className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">
                                対応中
                              </span>
                            ) : (
                              <Button
                                type="button"
                                className="h-7 bg-indigo-600 px-2 py-0 text-xs font-semibold whitespace-nowrap hover:bg-indigo-700"
                                onClick={() => void updateTaskStatus(task.id, 'in_progress')}
                                disabled={savingId === task.id || isResolved}
                              >
                                {savingId === task.id ? '更新中...' : '対応開始'}
                              </Button>
                            )}
                            <Link
                              href={`/appointments?tab=list&modal=create${task.sourceAppointmentId ? `&followup_from=${task.sourceAppointmentId}` : ''}&followup_task_id=${task.id}&followup_customer_id=${task.customerId}${task.petId ? `&followup_pet_id=${task.petId}` : ''}`}
                              className="inline-flex h-7 items-center justify-center rounded bg-slate-900 px-2 py-0 text-xs font-semibold text-white whitespace-nowrap hover:bg-slate-800"
                            >
                              予約作成
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          type="button"
                          className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          onClick={() => toggleQueueRowExpansion(task.id)}
                        >
                          {isExpanded ? '閉じる' : '詳細'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-gray-50 text-gray-700">
                        <td className="px-2.5 py-2" colSpan={6}>
                          <div className="grid gap-2 text-xs md:grid-cols-2">
                            <p>ペット: {task.petName ?? '未登録'}</p>
                            <p>前回来店: {toJstDateLabel(task.lastVisitAt)}</p>
                            <p>推奨来店日: {toJstDateLabel(task.recommendedAt)}</p>
                            <p>電話: {task.phoneNumber ?? '未登録'}</p>
                            <p>LINE: {task.lineId ?? '未登録'}</p>
                            <p>メモ: {task.resolutionNote ?? 'なし'}</p>
                          </div>
                          {!readOnly ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
                                onClick={() => openActionModal(task.id, '保留理由', 'snoozed')}
                                disabled={savingId === task.id || isResolved}
                              >
                                1週間保留
                              </Button>
                              <Button
                                type="button"
                                className="h-7 bg-emerald-600 px-2 py-0 text-xs font-semibold whitespace-nowrap hover:bg-emerald-700"
                                onClick={() => openActionModal(task.id, '不要理由', 'resolved_no_need', 'no_need')}
                                disabled={savingId === task.id || isResolved}
                              >
                                不要
                              </Button>
                              <Button
                                type="button"
                                className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 whitespace-nowrap hover:bg-red-100"
                                onClick={() => openActionModal(task.id, '失注理由', 'resolved_lost', 'declined')}
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
                                  className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
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
                                  className="inline-flex h-7 items-center justify-center rounded bg-emerald-600 px-2 py-0 text-xs font-semibold text-white whitespace-nowrap hover:bg-emerald-700"
                                >
                                  LINE送信
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-2 text-xs">
                            {task.events.length > 0 ? (
                              <div className="space-y-1 text-gray-600">
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
                                    {expandedTaskIds.includes(task.id) ? '履歴を閉じる' : '履歴をもっと見る'}
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-gray-400">履歴なし</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">再来店フォロー一覧</h2>
          <p className="text-xs text-gray-500">候補抽出ではなく、対応キューとして運用します。</p>
        </div>
        <Button type="button" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50" onClick={() => void loadData()}>
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
              <p className="text-xs text-gray-500">{visibleCandidates.length} 件</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={visibleCandidates.length > 0 && selectedVisibleCount === visibleCandidates.length}
                  onChange={(event) => setAllSelection(event.target.checked)}
                />
                全選択
              </label>
              <Button
                type="button"
                className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
                onClick={copyFollowupMessage}
              >
                一括連絡文をコピー
              </Button>
              <Button type="button" className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50" onClick={copyPhoneList}>
                電話一覧をコピー
              </Button>
              <Button type="button" className="h-7 bg-emerald-600 px-2 py-0 text-xs font-semibold whitespace-nowrap hover:bg-emerald-700" onClick={copyLineList}>
                LINE一覧をコピー
              </Button>
            </div>

            {visibleCandidates.length === 0 ? (
              <p className="text-sm text-gray-500">新規候補はありません。</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2.5 py-2">選択</th>
                      <th className="px-2.5 py-2">顧客</th>
                      <th className="px-2.5 py-2">超過日数</th>
                      <th className="px-2.5 py-2">担当引継ぎ</th>
                      <th className="px-2.5 py-2">操作</th>
                      <th className="px-2.5 py-2">詳細</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleCandidates.map((row) => {
                      const isExpanded = expandedCandidateIds.includes(row.customerId)
                      return (
                        <Fragment key={row.customerId}>
                          <tr className="text-gray-700">
                            <td className="px-2.5 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.customerId)}
                                onChange={() => toggleSelection(row.customerId)}
                              />
                            </td>
                            <td className="px-2.5 py-2 font-medium text-gray-900">{row.customerName}</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getOverdueTone(row.overdueDays)}`}>
                                {row.overdueDays} 日
                              </span>
                            </td>
                            <td className="px-2.5 py-2">{row.suggestedAssignedName ?? '未割当'}</td>
                            <td className="px-2.5 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  className="h-7 bg-slate-900 px-2 py-0 text-xs font-semibold text-white whitespace-nowrap hover:bg-slate-800"
                                  onClick={() => void createTask(row)}
                                  disabled={savingId === row.customerId}
                                >
                                  キューに追加
                                </Button>
                                {row.phoneNumber ? (
                                  <a
                                    href={`tel:${row.phoneNumber}`}
                                    className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
                                  >
                                    電話する
                                  </a>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-2.5 py-2">
                              <button
                                type="button"
                                className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                onClick={() => toggleCandidateExpansion(row.customerId)}
                              >
                                {isExpanded ? '閉じる' : '詳細'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-gray-50 text-gray-700">
                              <td className="px-2.5 py-2" colSpan={6}>
                                <div className="grid gap-2 text-xs md:grid-cols-2">
                                  <p>ペット: {row.petId ? '引継ぎあり' : '未特定'}</p>
                                  <p>前回来店: {toJstDateLabel(row.lastVisitAt)}</p>
                                  <p>推奨来店日: {toJstDateLabel(row.recommendedAt)}</p>
                                  <p>電話: {row.phoneNumber ?? '未登録'}</p>
                                  <p>LINE: {row.lineId ?? '未登録'}</p>
                                  <p>算出根拠: {row.recommendationReason}</p>
                                </div>
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void copySingleFollowupMessage(row)
                                    }}
                                    className="inline-flex h-7 items-center justify-center rounded bg-emerald-600 px-2 py-0 text-xs font-semibold text-white whitespace-nowrap hover:bg-emerald-700"
                                  >
                                    LINE文面コピー
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {renderTaskSection(
            '対応中',
            '未着手・対応中・保留のタスクを優先順で表示します。',
            inProgressTaskRows,
            '対応中タスクはありません。'
          )}
          {renderTaskSection(
            '対応済',
            '予約化・不要・失注の完了タスクです（対象期間フィルターの表示条件が適用されます）。',
            resolvedTaskRows,
            '対応済タスクはありません。',
            true
          )}
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
                <Button
                  type="button"
                  className="h-7 bg-slate-900 px-2 py-0 text-xs font-semibold text-white whitespace-nowrap hover:bg-slate-800"
                  onClick={() => void submitActionModal()}
                  disabled={Boolean(savingId)}
                >
                  保存する
                </Button>
                <Button
                  type="button"
                  className="h-7 border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
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
