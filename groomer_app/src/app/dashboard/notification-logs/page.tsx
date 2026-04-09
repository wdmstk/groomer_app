import Link from 'next/link'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { dashboardPageFixtures } from '@/lib/e2e/dashboard-page-fixtures'
import type { Json } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type NotificationLogsPageProps = {
  searchParams?: Promise<{
    type?: string
    channel?: string
    status?: string
    q?: string
    page?: string
  }>
}

type NotificationLogRow = {
  id: string
  created_at: string
  customer_id: string | null
  appointment_id: string | null
  slot_reoffer_id: string | null
  channel: string
  notification_type: string
  status: string
  subject: string | null
  body: string | null
  target: string | null
  dedupe_key: string | null
  payload: { [key: string]: Json | undefined } | null
  sent_at: string
  customers?:
    | { id: string; full_name: string; phone_number: string | null; line_id: string | null }
    | { id: string; full_name: string; phone_number: string | null; line_id: string | null }[]
    | null
}

function getRelationValue<T extends Record<string, string | null>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.[key] ?? null
  return relation[key] ?? null
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
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

function getFailureReason(payload: { [key: string]: Json | undefined } | null) {
  if (!payload) return 'unknown'
  if (typeof payload.reason === 'string' && payload.reason) return payload.reason
  if (typeof payload.notification_status === 'string' && payload.notification_status) {
    return payload.notification_status
  }
  if (typeof payload.result === 'string' && payload.result) return payload.result
  return 'unknown'
}

function getStatusTone(status: string) {
  switch (status) {
    case 'sent':
      return 'bg-emerald-100 text-emerald-800'
    case 'failed':
      return 'bg-rose-100 text-rose-800'
    case 'queued':
      return 'bg-amber-100 text-amber-900'
    case 'canceled':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default async function NotificationLogsPage({ searchParams }: NotificationLogsPageProps) {
  const resolvedSearchParams = await searchParams
  const supabase = isPlaywrightE2E ? null : await createServerSupabaseClient()
  const storeId = isPlaywrightE2E ? dashboardPageFixtures.storeId : await resolveCurrentStoreId()

  if (!storeId) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">通知ログ</h1>
          <p className="text-gray-600">有効な店舗が設定されていません。</p>
        </div>
      </section>
    )
  }

  const typeFilter = resolvedSearchParams?.type?.trim() ?? 'all'
  const channelFilter = resolvedSearchParams?.channel?.trim() ?? 'all'
  const statusFilter = resolvedSearchParams?.status?.trim() ?? 'all'
  const query = resolvedSearchParams?.q?.trim() ?? ''
  const page = Math.max(1, Number(resolvedSearchParams?.page ?? '1') || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let data: NotificationLogRow[] | null = null
  let error: { message: string } | null = null
  let count = 0
  let failureRows: Array<{
    status: string
    notification_type: string
    payload: { [key: string]: Json | undefined } | null
  }> | null = null
  let failureError: { message: string } | null = null

  if (isPlaywrightE2E) {
    let fixtureRows = [...dashboardPageFixtures.notificationLogs]
    if (typeFilter !== 'all') fixtureRows = fixtureRows.filter((row) => row.notification_type === typeFilter)
    if (channelFilter !== 'all') fixtureRows = fixtureRows.filter((row) => row.channel === channelFilter)
    if (statusFilter !== 'all') fixtureRows = fixtureRows.filter((row) => row.status === statusFilter)
    if (query) {
      const customerIds = dashboardPageFixtures.notificationQueryCustomerIds.map((row): string => row.id)
      fixtureRows = fixtureRows.filter(
        (row) =>
          row.subject?.includes(query) ||
          row.body?.includes(query) ||
          row.dedupe_key?.includes(query) ||
          (row.customer_id ? customerIds.includes(row.customer_id) : false)
      )
    }
    count = fixtureRows.length
    data = fixtureRows.slice(from, to + 1) as NotificationLogRow[]
    failureRows = fixtureRows
      .filter((row) => ['failed', 'canceled'].includes(String(row.status)))
      .map((row) => ({
        status: row.status,
        notification_type: row.notification_type,
        payload: row.payload,
      }))
  } else {
    let logQuery = supabase!
      .from('customer_notification_logs')
      .select(
        'id, created_at, customer_id, appointment_id, slot_reoffer_id, channel, notification_type, status, subject, body, target, dedupe_key, payload, sent_at, customers(id, full_name, phone_number, line_id)'
      )
      .eq('store_id', storeId)
      .order('sent_at', { ascending: false })
      .range(from, to)

    let countQuery = supabase!
      .from('customer_notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)

    let failureSummaryQuery = supabase!
      .from('customer_notification_logs')
      .select('status, notification_type, payload')
      .eq('store_id', storeId)

    if (typeFilter !== 'all') {
      logQuery = logQuery.eq('notification_type', typeFilter)
      countQuery = countQuery.eq('notification_type', typeFilter)
      failureSummaryQuery = failureSummaryQuery.eq('notification_type', typeFilter)
    }
    if (channelFilter !== 'all') {
      logQuery = logQuery.eq('channel', channelFilter)
      countQuery = countQuery.eq('channel', channelFilter)
      failureSummaryQuery = failureSummaryQuery.eq('channel', channelFilter)
    }
    if (statusFilter !== 'all') {
      logQuery = logQuery.eq('status', statusFilter)
      countQuery = countQuery.eq('status', statusFilter)
      failureSummaryQuery = failureSummaryQuery.eq('status', statusFilter)
    }
    if (query) {
      const { data: matchingCustomers } = await supabase!
        .from('customers')
        .select('id')
        .eq('store_id', storeId)
        .ilike('full_name', `%${query}%`)
        .limit(100)
      const customerIds = ((matchingCustomers ?? []) as Array<{ id: string }>).map((row) => row.id)
      const orFilters = [
        `subject.ilike.%${query}%`,
        `body.ilike.%${query}%`,
        `dedupe_key.ilike.%${query}%`,
      ]
      if (customerIds.length > 0) {
        orFilters.push(`customer_id.in.(${customerIds.join(',')})`)
      }
      logQuery = logQuery.or(orFilters.join(','))
      countQuery = countQuery.or(orFilters.join(','))
      failureSummaryQuery = failureSummaryQuery.or(orFilters.join(','))
    }

    const queryResults = await Promise.all([
      logQuery,
      countQuery,
      failureSummaryQuery.in('status', ['failed', 'canceled']),
    ])
    data = (queryResults[0].data ?? []) as NotificationLogRow[]
    error = queryResults[0].error
    count = queryResults[1].count ?? 0
    failureRows = queryResults[2].data as Array<{
      status: string
      notification_type: string
      payload: { [key: string]: Json | undefined } | null
    }> | null
    failureError = queryResults[2].error
  }

  const rows = ((data ?? []) as NotificationLogRow[]) ?? []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const counts = rows.reduce(
    (acc, row) => {
      acc.total += 1
      acc.byType[row.notification_type] = (acc.byType[row.notification_type] ?? 0) + 1
      acc.byChannel[row.channel] = (acc.byChannel[row.channel] ?? 0) + 1
      acc.byStatus[row.status] = (acc.byStatus[row.status] ?? 0) + 1
      return acc
    },
    {
      total: 0,
      byType: {} as Record<string, number>,
      byChannel: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    }
  )
  const failureSummary = (((failureRows ?? []) as Array<{
    status: string
    notification_type: string
    payload: { [key: string]: Json | undefined } | null
  }>) ?? []
  ).reduce(
    (acc, row) => {
      const key = `${row.notification_type}:${getFailureReason(row.payload)}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">通知ログ</h1>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">種別</span>
            <select
              name="type"
              defaultValue={typeFilter}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="followup">followup</option>
              <option value="slot_reoffer">slot_reoffer</option>
              <option value="reminder">reminder</option>
              <option value="test_send">test_send</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">チャネル</span>
            <select
              name="channel"
              defaultValue={channelFilter}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="line">line</option>
              <option value="phone">phone</option>
              <option value="email">email</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">状態</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="queued">queued</option>
              <option value="canceled">canceled</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">検索</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="顧客名・件名・本文・dedupe_key"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              絞り込む
            </button>
            <Link href="/dashboard/notification-logs" className="text-sm text-gray-500">
              クリア
            </Link>
          </div>
        </form>
      </Card>

      {error || failureError ? (
        <Card>
          <p className="text-sm text-red-600">{error?.message ?? failureError?.message}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">総件数</p>
          <p className="text-2xl font-semibold text-gray-900">{totalCount} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">種別内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.entries(counts.byType).map(([key, value]) => (
              <p key={key}>
                {key}: {value} 件
              </p>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">チャネル内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.entries(counts.byChannel).map(([key, value]) => (
              <p key={key}>
                {key}: {value} 件
              </p>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">状態内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.entries(counts.byStatus).length === 0 ? (
              <p>なし</p>
            ) : (
              Object.entries(counts.byStatus).map(([key, value]) => (
                <p key={key}>
                  {key}: {value} 件
                </p>
              ))
            )}
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">失敗/スキップ内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.keys(failureSummary).length === 0 ? (
              <p>なし</p>
            ) : (
              Object.entries(failureSummary).map(([key, value]) => (
                <p key={key}>
                  {key}: {value} 件
                </p>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">送信履歴</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {rows.length === 0 ? 0 : from + 1}-{from + rows.length} 件表示 / {totalCount} 件中 / {page} / {totalPages} ページ
            </p>
            <Link href="/dashboard" className="text-sm font-semibold text-blue-700">
              ダッシュボードへ
            </Link>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">通知ログはまだありません。</p>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
                  <p className="text-xs text-gray-500">{formatDateTime(row.sent_at)}</p>
                  <p className="mt-1 truncate font-semibold text-gray-900">
                    {getRelationValue(row.customers, 'full_name') ?? '未登録'}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {row.notification_type} / {row.channel} / {row.target ?? '-'}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">件名: {row.subject ?? '-'}</p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">本文: {row.body ?? '-'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getStatusTone(row.status)}`}>
                      {row.status}
                    </span>
                    <span className="text-xs text-gray-500">key: {row.dedupe_key ?? '-'}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden md:block" data-testid="notification-logs-table-wrap">
              <table className="min-w-full table-fixed text-left text-sm" data-testid="notification-logs-table">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">通知</th>
                    <th className="px-2.5 py-2">顧客/送信先</th>
                    <th className="px-2.5 py-2">内容</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top text-gray-700" data-testid={`notification-log-row-${row.id}`}>
                      <td className="px-2.5 py-2">
                        <p>{formatDateTime(row.sent_at)}</p>
                        <p className="text-xs text-gray-500">
                          {row.notification_type} / {row.channel}
                        </p>
                        <p className="truncate text-xs text-gray-500">dedupe: {row.dedupe_key ?? '-'}</p>
                      </td>
                      <td className="px-2.5 py-2">
                        <p className="truncate font-medium text-gray-900">
                          {getRelationValue(row.customers, 'full_name') ?? '未登録'}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          電話: {getRelationValue(row.customers, 'phone_number') ?? '未登録'} / LINE:{' '}
                          {getRelationValue(row.customers, 'line_id') ?? '未登録'}
                        </p>
                        <p className="truncate text-xs text-gray-500">送信先: {row.target ?? '-'}</p>
                      </td>
                      <td className="px-2.5 py-2">
                        <p className="truncate">{row.subject ?? '-'}</p>
                        <p className="line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">{row.body ?? '-'}</p>
                      </td>
                      <td className="px-2.5 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getStatusTone(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-gray-600">
          <Link
            href={`/dashboard/notification-logs?type=${encodeURIComponent(typeFilter)}&channel=${encodeURIComponent(channelFilter)}&status=${encodeURIComponent(statusFilter)}&q=${encodeURIComponent(query)}&page=${Math.max(1, page - 1)}`}
            className={`rounded border px-3 py-2 ${page <= 1 ? 'pointer-events-none text-gray-300' : ''}`}
          >
            前へ
          </Link>
          <span>
            {page} / {totalPages} ページ
          </span>
          <Link
            href={`/dashboard/notification-logs?type=${encodeURIComponent(typeFilter)}&channel=${encodeURIComponent(channelFilter)}&status=${encodeURIComponent(statusFilter)}&q=${encodeURIComponent(query)}&page=${page + 1}`}
            className={`rounded border px-3 py-2 ${page >= totalPages ? 'pointer-events-none text-gray-300' : ''}`}
          >
            次へ
          </Link>
        </div>
      </Card>
    </section>
  )
}
