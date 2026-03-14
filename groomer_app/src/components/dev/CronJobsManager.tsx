'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import type { Json } from '@/lib/supabase/database.types'
import { asJsonObjectOrNull } from '@/lib/object-utils'

type JobRunStatus = 'running' | 'succeeded' | 'failed'
type JobRunTrigger = 'scheduled' | 'manual_rerun' | 'manual_direct'

type JobRunItem = {
  id: string
  jobName: string
  status: string
  startedAt: string
  finishedAt: string | null
  retries: number
  lastError: string | null
  trigger: string
  requestedByUserId: string | null
  sourceJobRunId: string | null
  meta: { [key: string]: Json | undefined }
}

type JobRunsResponse = {
  items: JobRunItem[]
  page: number
  limit: number
  totalCount: number
  hasMore: boolean
}

type JobLocksResponse = {
  items: Array<{
    jobName: string
    jobRunId: string
    expiresAt: string
    createdAt: string
    updatedAt: string
  }>
}

type ManualLockReleaseAuditItem = {
  id: string
  releasedAt: string
  jobRunId: string
  jobName: string
  requestedByUserId: string
  requestedByEmail: string | null
  lockJobRunId: string
  lockJobName: string
}

type JobLockItem = JobLocksResponse['items'][number]

const JOB_NAMES = [
  'billing-status-sync',
  'billing-trial-rollover',
  'billing-reminders',
  'remind-appointments',
  'scan-storage-orphans',
] as const

const STATUS_TABS: Array<{ value: JobRunStatus; label: string }> = [
  { value: 'failed', label: '失敗' },
  { value: 'running', label: '実行中' },
  { value: 'succeeded', label: '成功' },
]

const TRIGGER_OPTIONS: Array<{ value: JobRunTrigger; label: string }> = [
  { value: 'scheduled', label: 'scheduled' },
  { value: 'manual_rerun', label: 'manual_rerun' },
  { value: 'manual_direct', label: 'manual_direct' },
]

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP')
}

function isExpired(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() <= Date.now()
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10)
}

function buildRangeIso(value: string, endOfDay = false) {
  if (!value) return ''
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
}

function getSkippedBreakdown(meta: { [key: string]: Json | undefined }) {
  const counters = asJsonObjectOrNull(meta.counters)
  const breakdown =
    asJsonObjectOrNull(counters?.skippedBreakdown) ?? asJsonObjectOrNull(meta.skippedBreakdown)

  if (!breakdown) return null
  return {
    dedupe: Number(breakdown.dedupe ?? 0) || 0,
    failed: Number(breakdown.failed ?? 0) || 0,
    missingCustomer: Number(breakdown.missing_customer ?? 0) || 0,
    missingLineTarget: Number(breakdown.missing_line_target ?? 0) || 0,
    missingEmailTarget: Number(breakdown.missing_email_target ?? 0) || 0,
  }
}

export function CronJobsManager() {
  const [items, setItems] = useState<JobRunItem[]>([])
  const [status, setStatus] = useState<JobRunStatus>('failed')
  const [jobName, setJobName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [requestedByUserId, setRequestedByUserId] = useState('')
  const [startedFrom, setStartedFrom] = useState('')
  const [startedTo, setStartedTo] = useState(todayDateInput())
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [expandedRerunId, setExpandedRerunId] = useState<string | null>(null)
  const [rerunReason, setRerunReason] = useState('')
  const [manualJobName, setManualJobName] = useState<(typeof JOB_NAMES)[number]>('billing-status-sync')
  const [manualReason, setManualReason] = useState('')
  const [selectedJobRunId, setSelectedJobRunId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<JobRunItem | null>(null)
  const [selectedManualLockReleases, setSelectedManualLockReleases] = useState<
    ManualLockReleaseAuditItem[]
  >([])
  const [detailError, setDetailError] = useState('')
  const [locks, setLocks] = useState<JobLocksResponse['items']>([])
  const [locksError, setLocksError] = useState('')
  const [isLocksLoading, setIsLocksLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const expiredLocks = locks.filter((lock) => isExpired(lock.expiresAt))

  const loadItems = useCallback(async (params?: { nextPage?: number }) => {
    const nextPage = params?.nextPage ?? page
    setIsLoading(true)
    setError('')
    try {
      const query = new URLSearchParams()
      query.set('limit', String(limit))
      query.set('page', String(nextPage))
      query.set('status', status)
      if (jobName) {
        query.set('jobName', jobName)
      }
      if (trigger) {
        query.set('trigger', trigger)
      }
      if (requestedByUserId.trim()) {
        query.set('requestedByUserId', requestedByUserId.trim())
      }
      if (startedFrom) {
        query.set('startedFrom', buildRangeIso(startedFrom))
      }
      if (startedTo) {
        query.set('startedTo', buildRangeIso(startedTo, true))
      }
      const response = await fetch(`/api/admin/cron/job-runs?${query.toString()}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as JobRunsResponse | { message?: string }
      if (!response.ok) {
        setError(data && 'message' in data ? data.message ?? '取得に失敗しました。' : '取得に失敗しました。')
        setItems([])
        return
      }
      const result = data as JobRunsResponse
      setItems(result.items)
      setTotalCount(result.totalCount)
      setHasMore(result.hasMore)
      setPage(result.page)
      if (selectedJobRunId) {
        const matched = result.items.find((item) => item.id === selectedJobRunId)
        if (matched) {
          setSelectedItem(matched)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '取得に失敗しました。')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [jobName, limit, page, requestedByUserId, selectedJobRunId, startedFrom, startedTo, status, trigger])

  async function loadJobRunDetail(jobRunId: string) {
    setDetailError('')
    try {
      const response = await fetch(`/api/admin/cron/job-runs/${encodeURIComponent(jobRunId)}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as {
        item?: JobRunItem
        manualLockReleases?: ManualLockReleaseAuditItem[]
        message?: string
      }
      if (!response.ok || !data.item) {
        setDetailError(data.message ?? '詳細取得に失敗しました。')
        return
      }
      setSelectedJobRunId(jobRunId)
      setSelectedItem(data.item)
      setSelectedManualLockReleases(data.manualLockReleases ?? [])
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '詳細取得に失敗しました。')
    }
  }

  async function loadJobLocks() {
    setIsLocksLoading(true)
    setLocksError('')
    try {
      const response = await fetch('/api/admin/cron/job-locks', { cache: 'no-store' })
      const data = (await response.json()) as JobLocksResponse | { message?: string }
      if (!response.ok) {
        setLocksError(
          data && 'message' in data
            ? data.message ?? 'job_locks の取得に失敗しました。'
            : 'job_locks の取得に失敗しました。'
        )
        setLocks([])
        return
      }
      setLocks((data as JobLocksResponse).items)
    } catch (error) {
      setLocksError(error instanceof Error ? error.message : 'job_locks の取得に失敗しました。')
      setLocks([])
    } finally {
      setIsLocksLoading(false)
    }
  }

  function releaseLock(lock: JobLockItem) {
    setPendingId(`lock:${lock.jobRunId}`)
    setLocksError('')
    setMessage('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/cron/job-locks', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobRunId: lock.jobRunId,
          }),
        })
        const data = (await response.json()) as { message?: string }
        if (!response.ok) {
          setLocksError(data.message ?? 'job_locks の解放に失敗しました。')
          return
        }
        setMessage(`${lock.jobName} の lock を解放しました。`)
        await loadJobLocks()
        if (selectedJobRunId === lock.jobRunId) {
          await loadJobRunDetail(lock.jobRunId)
        }
      } catch (error) {
        setLocksError(error instanceof Error ? error.message : 'job_locks の解放に失敗しました。')
      } finally {
        setPendingId(null)
      }
    })
  }

  useEffect(() => {
    void loadItems({ nextPage: 1 })
  }, [loadItems])

  useEffect(() => {
    void loadJobLocks()
  }, [])

  function openRerunForm(item: JobRunItem) {
    setExpandedRerunId(item.id)
    setRerunReason(item.lastError ?? 'manual rerun')
    setError('')
    setMessage('')
  }

  function submitRerun(item: JobRunItem) {
    setPendingId(item.id)
    setError('')
    setMessage('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/cron/rerun', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobName: item.jobName,
            sourceJobRunId: item.id,
            reason: rerunReason.trim() || null,
          }),
        })

        const data = (await response.json()) as { message?: string; jobRunId?: string }
        if (!response.ok) {
          setError(data.message ?? '再実行に失敗しました。')
          return
        }

        setMessage(`${item.jobName} を再実行しました。jobRunId: ${data.jobRunId ?? '-'}`)
        if (data.jobRunId) {
          await loadJobRunDetail(data.jobRunId)
        }
        setExpandedRerunId(null)
        setRerunReason('')
        await loadItems()
        await loadJobLocks()
      } catch (error) {
        setError(error instanceof Error ? error.message : '再実行に失敗しました。')
      } finally {
        setPendingId(null)
      }
    })
  }

  function submitManualDirectRun() {
    setPendingId('manual-direct')
    setError('')
    setMessage('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/cron/rerun', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobName: manualJobName,
            reason: manualReason.trim() || null,
          }),
        })
        const data = (await response.json()) as { message?: string; jobRunId?: string }
        if (!response.ok) {
          setError(data.message ?? '手動実行に失敗しました。')
          return
        }
        setMessage(`${manualJobName} を手動実行しました。jobRunId: ${data.jobRunId ?? '-'}`)
        setManualReason('')
        if (data.jobRunId) {
          await loadJobRunDetail(data.jobRunId)
        }
        await loadItems({ nextPage: 1 })
        await loadJobLocks()
      } catch (error) {
        setError(error instanceof Error ? error.message : '手動実行に失敗しました。')
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const active = tab.value === status
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="cron-job-filter" className="block text-sm font-medium text-gray-700">
                ジョブ
              </label>
              <select
                id="cron-job-filter"
                value={jobName}
                onChange={(event) => setJobName(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm text-gray-900"
              >
                <option value="">すべて</option>
                {JOB_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="cron-trigger-filter" className="block text-sm font-medium text-gray-700">
                trigger
              </label>
              <select
                id="cron-trigger-filter"
                value={trigger}
                onChange={(event) => setTrigger(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm text-gray-900"
              >
                <option value="">すべて</option>
                {TRIGGER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="cron-requested-by-filter" className="block text-sm font-medium text-gray-700">
                requestedByUserId
              </label>
              <input
                id="cron-requested-by-filter"
                type="text"
                value={requestedByUserId}
                onChange={(event) => setRequestedByUserId(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm text-gray-900"
                placeholder="user id"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cron-started-from" className="block text-sm font-medium text-gray-700">
                開始日 From
              </label>
              <input
                id="cron-started-from"
                type="date"
                value={startedFrom}
                onChange={(event) => setStartedFrom(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cron-started-to" className="block text-sm font-medium text-gray-700">
                開始日 To
              </label>
              <input
                id="cron-started-to"
                type="date"
                value={startedTo}
                onChange={(event) => setStartedTo(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadItems({ nextPage: 1 })}
                className="inline-flex w-full items-center justify-center rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                再読込
              </button>
            </div>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">手動実行</h2>
            <p className="mt-1 text-sm text-gray-600">
              失敗履歴に依存せず、`manual_direct` として対象ジョブを直接起動します。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_1fr_auto]">
            <select
              value={manualJobName}
              onChange={(event) => setManualJobName(event.target.value as (typeof JOB_NAMES)[number])}
              className="w-full rounded border px-3 py-2 text-sm text-gray-900"
            >
              {JOB_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={manualReason}
              onChange={(event) => setManualReason(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm text-gray-900"
              placeholder="実行理由"
            />
            <button
              type="button"
              onClick={submitManualDirectRun}
              disabled={isPending && pendingId === 'manual-direct'}
              className="inline-flex items-center justify-center rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {isPending && pendingId === 'manual-direct' ? '実行中...' : '直接実行'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">現在の job_locks</h2>
            <p className="mt-1 text-sm text-gray-600">
              DB 側で保持中の Cron ロックを確認します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadJobLocks()}
            className="rounded border px-3 py-2 text-sm font-semibold text-gray-700"
          >
            job_locks 再読込
          </button>
        </div>

        {locksError ? <p className="text-sm text-red-700">{locksError}</p> : null}
        {expiredLocks.length > 0 ? (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            期限切れの lock が {expiredLocks.length} 件あります。解放漏れやジョブ異常終了を確認してください。
          </div>
        ) : null}
        {isLocksLoading ? (
          <p className="text-sm text-gray-600">読み込み中です。</p>
        ) : locks.length === 0 ? (
          <p className="text-sm text-gray-600">保持中の lock はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">job</th>
                  <th className="px-2 py-2">jobRunId</th>
                  <th className="px-2 py-2">state</th>
                  <th className="px-2 py-2">expiresAt</th>
                  <th className="px-2 py-2">updatedAt</th>
                  <th className="px-2 py-2">action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {locks.map((lock) => {
                  const expired = isExpired(lock.expiresAt)
                  const releasing = isPending && pendingId === `lock:${lock.jobRunId}`
                  return (
                    <tr
                      key={lock.jobRunId}
                      className={expired ? 'bg-amber-50 text-amber-950' : 'text-gray-700'}
                    >
                      <td className="px-2 py-3">{lock.jobName}</td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => void loadJobRunDetail(lock.jobRunId)}
                          className="text-left text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {lock.jobRunId}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            expired
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {expired ? 'expired' : 'active'}
                        </span>
                      </td>
                      <td className="px-2 py-3">{formatDateTime(lock.expiresAt)}</td>
                      <td className="px-2 py-3">{formatDateTime(lock.updatedAt)}</td>
                      <td className="px-2 py-3">
                        {expired ? (
                          <button
                            type="button"
                            onClick={() => releaseLock(lock)}
                            disabled={releasing}
                            className="rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                          >
                            {releasing ? '解放中...' : '手動解放'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cron 実行一覧</h2>
            <p className="mt-1 text-sm text-gray-500">
              {totalCount} 件中 {items.length} 件を表示
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => void loadItems({ nextPage: Math.max(page - 1, 1) })}
              disabled={page <= 1 || isLoading}
              className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              前へ
            </button>
            <span>{page} ページ</span>
            <button
              type="button"
              onClick={() => void loadItems({ nextPage: page + 1 })}
              disabled={!hasMore || isLoading}
              className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              次へ
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-600">読み込み中です。</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-600">該当ジョブはありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">job</th>
                  <th className="px-2 py-2">status</th>
                  <th className="px-2 py-2">started</th>
                  <th className="px-2 py-2">finished</th>
                  <th className="px-2 py-2">trigger</th>
                  <th className="px-2 py-2">error</th>
                  <th className="px-2 py-2">action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const disabled = isPending && pendingId === item.id
                  const isExpanded = expandedRerunId === item.id
                  const canRerun = item.status === 'failed'

                  return (
                    <tr key={item.id} className="align-top text-gray-700">
                      <td className="px-2 py-3">
                        <div className="font-medium text-gray-900">{item.jobName}</div>
                        <div className="mt-1 text-xs text-gray-500">{item.id}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-2 py-3">{formatDateTime(item.startedAt)}</td>
                      <td className="px-2 py-3">{formatDateTime(item.finishedAt)}</td>
                      <td className="px-2 py-3">
                        <div>{item.trigger}</div>
                        <div className="mt-1 text-xs text-gray-500">retries: {item.retries}</div>
                      </td>
                      <td className="max-w-md px-2 py-3">
                        <div className="whitespace-pre-wrap break-words">{item.lastError ?? '-'}</div>
                        {item.sourceJobRunId ? (
                          <button
                            type="button"
                            onClick={() => void loadJobRunDetail(item.sourceJobRunId!)}
                            className="mt-1 text-left text-xs text-blue-700 hover:text-blue-800 hover:underline"
                          >
                            source: {item.sourceJobRunId}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        {!canRerun ? (
                          <button
                            type="button"
                            onClick={() => void loadJobRunDetail(item.id)}
                            className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700"
                          >
                            詳細
                          </button>
                        ) : isExpanded ? (
                          <div className="w-64 space-y-2">
                            <textarea
                              value={rerunReason}
                              onChange={(event) => setRerunReason(event.target.value)}
                              rows={3}
                              className="w-full rounded border px-3 py-2 text-sm text-gray-900"
                              placeholder="再実行理由"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => submitRerun(item)}
                                disabled={disabled}
                                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                              >
                                {disabled ? '送信中...' : '実行'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void loadJobRunDetail(item.id)}
                                className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700"
                              >
                                詳細
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedRerunId(null)
                                  setRerunReason('')
                                }}
                                className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700"
                              >
                                閉じる
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openRerunForm(item)}
                              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              再実行
                            </button>
                            <button
                              type="button"
                              onClick={() => void loadJobRunDetail(item.id)}
                              className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700"
                            >
                              詳細
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">選択ジョブ詳細</h2>
            <p className="mt-1 text-sm text-gray-500">
              再実行後の `jobRunId` や、個別レコードの `meta` を確認できます。
            </p>
          </div>
          {selectedJobRunId ? (
            <button
              type="button"
              onClick={() => void loadJobRunDetail(selectedJobRunId)}
              className="rounded border px-3 py-2 text-sm font-semibold text-gray-700"
            >
              詳細更新
            </button>
          ) : null}
        </div>

        {detailError ? <p className="text-sm text-red-700">{detailError}</p> : null}
        {!selectedItem ? (
          <p className="text-sm text-gray-600">一覧の「詳細」または再実行後の jobRunId から表示します。</p>
        ) : (
          <div className="space-y-4">
            {(() => {
              const skippedBreakdown = getSkippedBreakdown(selectedItem.meta)
              if (!skippedBreakdown) return null
              return (
                <div className="rounded border bg-amber-50 p-3">
                  <div className="text-xs font-semibold tracking-wide text-amber-800">
                    skipped 内訳
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-amber-950 md:grid-cols-2 xl:grid-cols-4">
                    <div>dedupe: {skippedBreakdown.dedupe}</div>
                    <div>failed: {skippedBreakdown.failed}</div>
                    <div>missing_customer: {skippedBreakdown.missingCustomer}</div>
                    <div>missing_line_target: {skippedBreakdown.missingLineTarget}</div>
                    <div>missing_email_target: {skippedBreakdown.missingEmailTarget}</div>
                  </div>
                </div>
              )
            })()}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">job</div>
                <div className="mt-1 break-all text-sm font-medium text-gray-900">
                  {selectedItem.jobName}
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">jobRunId</div>
                <div className="mt-1 break-all text-sm font-medium text-gray-900">
                  {selectedItem.id}
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">status</div>
                <div className="mt-1 text-sm font-medium text-gray-900">{selectedItem.status}</div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">trigger</div>
                <div className="mt-1 text-sm font-medium text-gray-900">{selectedItem.trigger}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">requestedByUserId</div>
                <div className="mt-1 break-all text-sm font-medium text-gray-900">
                  {selectedItem.requestedByUserId ?? '-'}
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">sourceJobRunId</div>
                {selectedItem.sourceJobRunId ? (
                  <button
                    type="button"
                    onClick={() => void loadJobRunDetail(selectedItem.sourceJobRunId!)}
                    className="mt-1 break-all text-left text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    {selectedItem.sourceJobRunId}
                  </button>
                ) : (
                  <div className="mt-1 break-all text-sm font-medium text-gray-900">-</div>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">startedAt</div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(selectedItem.startedAt)}
                </div>
              </div>
              <div className="rounded border bg-gray-50 p-3">
                <div className="text-xs font-semibold tracking-wide text-gray-500">finishedAt</div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(selectedItem.finishedAt)}
                </div>
              </div>
            </div>

            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-gray-500">lastError</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">
                {selectedItem.lastError ?? '-'}
              </div>
            </div>

            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs font-semibold tracking-wide text-gray-500">
                manual lock releases
              </div>
              {selectedManualLockReleases.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">手動解放の監査履歴はありません。</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedManualLockReleases.map((entry) => (
                    <div key={entry.id} className="rounded border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDateTime(entry.releasedAt)}
                        </div>
                        <div className="text-xs text-gray-500">{entry.lockJobName}</div>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                        <div>
                          <span className="font-medium text-gray-900">requestedBy:</span>{' '}
                          {entry.requestedByEmail ?? '-'}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">requestedByUserId:</span>{' '}
                          {entry.requestedByUserId}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">jobRunId:</span>{' '}
                          <button
                            type="button"
                            onClick={() => void loadJobRunDetail(entry.jobRunId)}
                            className="text-left text-blue-700 hover:text-blue-800 hover:underline"
                          >
                            {entry.jobRunId}
                          </button>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">lockJobRunId:</span>{' '}
                          <button
                            type="button"
                            onClick={() => void loadJobRunDetail(entry.lockJobRunId)}
                            className="text-left text-blue-700 hover:text-blue-800 hover:underline"
                          >
                            {entry.lockJobRunId}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border bg-gray-950 p-3 text-xs text-gray-100">
              <div className="mb-2 font-semibold tracking-wide text-gray-300">meta</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(selectedItem.meta, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
