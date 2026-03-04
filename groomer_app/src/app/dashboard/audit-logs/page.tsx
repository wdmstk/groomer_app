import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AuditLogsPageProps = {
  searchParams?: Promise<{
    entity_type?: string
    action?: string
    q?: string
    page?: string
  }>
}

type AuditLogRow = {
  id: string
  created_at: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  payload: Record<string, unknown> | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function summarizeMemberPortalLog(row: AuditLogRow) {
  const customerName = getString(row.payload?.customer_name)
  const customerId = getString(row.payload?.customer_id)
  const revokedCount = row.payload?.revoked_existing_count
  const expiresAt =
    getString(row.after?.expires_at) ??
    getString(row.before?.expires_at) ??
    getString(row.payload?.expires_at)

  if (row.action === 'created') {
    return [
      customerName ? `顧客=${customerName}` : customerId ? `customer_id=${customerId}` : null,
      expiresAt ? `expires_at=${expiresAt}` : null,
      typeof revokedCount === 'number' ? `revoke=${revokedCount}` : null,
    ]
      .filter(Boolean)
      .join(', ')
  }

  if (row.action === 'revoked') {
    return [
      customerName ? `顧客=${customerName}` : customerId ? `customer_id=${customerId}` : null,
      'status=revoked',
    ]
      .filter(Boolean)
      .join(', ')
  }

  if (row.action === 'accessed') {
    return [
      customerId ? `customer_id=${customerId}` : null,
      `last_used_at=${getString(row.after?.last_used_at) ?? '-'}`,
    ]
      .filter(Boolean)
      .join(', ')
  }

  return ''
}

function summarizeValue(value: Record<string, unknown> | null) {
  if (!value) return '-'
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'
  return entries
    .slice(0, 3)
    .map(([key, entryValue]) => `${key}=${typeof entryValue === 'object' ? '[...]' : String(entryValue)}`)
    .join(', ')
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

function formatJson(value: Record<string, unknown> | null) {
  if (!value) return '-'
  return JSON.stringify(value, null, 2)
}

function getActionTone(action: string) {
  if (action.includes('deleted') || action.includes('canceled')) return 'bg-rose-100 text-rose-800'
  if (action.includes('revoked')) return 'bg-slate-200 text-slate-700'
  if (action.includes('accessed')) return 'bg-amber-100 text-amber-900'
  if (action.includes('created') || action.includes('confirmed')) return 'bg-emerald-100 text-emerald-800'
  if (action.includes('updated') || action.includes('changed') || action.includes('moved')) {
    return 'bg-blue-100 text-blue-800'
  }
  return 'bg-gray-100 text-gray-700'
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const resolvedSearchParams = await searchParams
  const supabase = await createServerSupabaseClient()
  const storeId = await resolveCurrentStoreId()

  if (!storeId) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">監査ログ</h1>
          <p className="text-gray-600">有効な店舗が設定されていません。</p>
        </div>
      </section>
    )
  }

  const entityTypeFilter = resolvedSearchParams?.entity_type?.trim() ?? 'all'
  const actionFilter = resolvedSearchParams?.action?.trim() ?? 'all'
  const query = resolvedSearchParams?.q?.trim() ?? ''
  const page = Math.max(1, Number(resolvedSearchParams?.page ?? '1') || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let logQuery = supabase
    .from('audit_logs')
    .select('id, created_at, actor_user_id, entity_type, entity_id, action, before, after, payload')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(from, to)

  let countQuery = supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  if (entityTypeFilter !== 'all') {
    logQuery = logQuery.eq('entity_type', entityTypeFilter)
    countQuery = countQuery.eq('entity_type', entityTypeFilter)
  }
  if (actionFilter !== 'all') {
    logQuery = logQuery.eq('action', actionFilter)
    countQuery = countQuery.eq('action', actionFilter)
  }
  if (query) {
    const searchClause = [
      `entity_type.ilike.%${query}%`,
      `action.ilike.%${query}%`,
      `entity_id.ilike.%${query}%`,
      `actor_user_id.ilike.%${query}%`,
    ].join(',')
    logQuery = logQuery.or(searchClause)
    countQuery = countQuery.or(searchClause)
  }

  const [{ data, error }, { count }] = await Promise.all([logQuery, countQuery])

  const rows = ((data ?? []) as AuditLogRow[]) ?? []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const byEntityType = rows.reduce(
    (acc, row) => {
      acc[row.entity_type] = (acc[row.entity_type] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const byAction = rows.reduce(
    (acc, row) => {
      acc[row.action] = (acc[row.action] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">監査ログ</h1>
        <p className="text-gray-600">会計、来店、予約、在庫、followup、reoffer の変更履歴を確認します。</p>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">対象</span>
            <select
              name="entity_type"
              defaultValue={entityTypeFilter}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="payment">payment</option>
              <option value="visit">visit</option>
              <option value="appointment">appointment</option>
              <option value="inventory_item">inventory_item</option>
              <option value="inventory_movement">inventory_movement</option>
              <option value="purchase_order">purchase_order</option>
              <option value="purchase_order_item">purchase_order_item</option>
              <option value="followup_task">followup_task</option>
              <option value="slot_reoffer">slot_reoffer</option>
              <option value="customer">customer</option>
              <option value="pet">pet</option>
              <option value="medical_record">medical_record</option>
              <option value="member_portal_link">member_portal_link</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">操作</span>
            <select
              name="action"
              defaultValue={actionFilter}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="created">created</option>
              <option value="updated">updated</option>
              <option value="deleted">deleted</option>
              <option value="status_changed">status_changed</option>
              <option value="moved">moved</option>
              <option value="confirmed">confirmed</option>
              <option value="shared">shared</option>
              <option value="revoked">revoked</option>
              <option value="accessed">accessed</option>
              <option value="created_auto_from_payment">created_auto_from_payment</option>
              <option value="visit_linked">visit_linked</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs text-gray-500">検索</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="entity_type / action / entity_id / actor_user_id"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              絞り込む
            </button>
            <Link href="/dashboard/audit-logs" className="text-sm text-gray-500">
              クリア
            </Link>
          </div>
        </form>
      </Card>

      {error ? (
        <Card>
          <p className="text-sm text-red-600">{error.message}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">総件数</p>
          <p className="text-2xl font-semibold text-gray-900">{totalCount} 件</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">対象内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.keys(byEntityType).length === 0 ? (
              <p>なし</p>
            ) : (
              Object.entries(byEntityType).map(([key, value]) => (
                <p key={key}>
                  {key}: {value} 件
                </p>
              ))
            )}
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">操作内訳</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            {Object.keys(byAction).length === 0 ? (
              <p>なし</p>
            ) : (
              Object.entries(byAction).map(([key, value]) => (
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
          <h2 className="text-lg font-semibold text-gray-900">変更履歴</h2>
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
          <p className="text-sm text-gray-500">監査ログはまだありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="px-2 py-2">日時</th>
                  <th className="px-2 py-2">対象</th>
                  <th className="px-2 py-2">操作</th>
                  <th className="px-2 py-2">entity_id</th>
                  <th className="px-2 py-2">actor_user_id</th>
                  <th className="px-2 py-2">要約</th>
                  <th className="px-2 py-2">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top text-gray-700">
                    <td className="px-2 py-3">{formatDateTime(row.created_at)}</td>
                    <td className="px-2 py-3">{row.entity_type}</td>
                    <td className="px-2 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${getActionTone(row.action)}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs text-gray-600">{row.entity_id}</td>
                    <td className="px-2 py-3 text-xs text-gray-600">{row.actor_user_id ?? '-'}</td>
                    <td className="max-w-sm px-2 py-3 text-xs text-gray-600">
                      {row.entity_type === 'member_portal_link' ? (
                        <p>{summarizeMemberPortalLog(row) || '-'}</p>
                      ) : (
                        <>
                          <p>before: {summarizeValue(row.before)}</p>
                          <p className="mt-1">after: {summarizeValue(row.after)}</p>
                          <p className="mt-1">payload: {summarizeValue(row.payload)}</p>
                        </>
                      )}
                    </td>
                    <td className="max-w-md px-2 py-3">
                      <details className="rounded border bg-gray-50 p-2">
                        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                          JSONを開く
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold text-gray-500">before</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-600">
                              {formatJson(row.before)}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold text-gray-500">after</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-600">
                              {formatJson(row.after)}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold text-gray-500">payload</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-600">
                              {formatJson(row.payload)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-gray-600">
          <Link
            href={`/dashboard/audit-logs?entity_type=${encodeURIComponent(entityTypeFilter)}&action=${encodeURIComponent(actionFilter)}&q=${encodeURIComponent(query)}&page=${Math.max(1, page - 1)}`}
            className={`rounded border px-3 py-2 ${page <= 1 ? 'pointer-events-none text-gray-300' : ''}`}
          >
            前へ
          </Link>
          <span>
            {page} / {totalPages} ページ
          </span>
          <Link
            href={`/dashboard/audit-logs?entity_type=${encodeURIComponent(entityTypeFilter)}&action=${encodeURIComponent(actionFilter)}&q=${encodeURIComponent(query)}&page=${page + 1}`}
            className={`rounded border px-3 py-2 ${page >= totalPages ? 'pointer-events-none text-gray-300' : ''}`}
          >
            次へ
          </Link>
        </div>
      </Card>
    </section>
  )
}
