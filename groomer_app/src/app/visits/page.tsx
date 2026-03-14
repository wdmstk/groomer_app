import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CustomerOption = {
  id: string
  full_name: string
}

type AppointmentOption = {
  id: string
}

type StaffOption = {
  id: string
  full_name: string
}

type VisitsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
  }>
}

type ActiveTab = 'list' | 'revisit' | 'followup' | 'cycle' | 'quality'

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未登録'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未登録'
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

function formatDateJst(value: string | null | undefined) {
  if (!value) return '未登録'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未登録'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 1000) / 10
}

function toJstHour(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return -1
  const hour = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  }).format(date)
  return Number(hour)
}

function diffDays(later: string, earlier: string) {
  const laterMs = new Date(later).getTime()
  const earlierMs = new Date(earlier).getTime()
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return 0
  return Math.max(0, Math.floor((laterMs - earlierMs) / (24 * 60 * 60 * 1000)))
}

function getRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

function getVisitPetName(
  relation:
    | { id: string; pets?: { name: string } | { name: string }[] | null }
    | { id: string; pets?: { name: string } | { name: string }[] | null }[]
    | null
    | undefined
) {
  if (!relation) return '未登録'
  const appointment = Array.isArray(relation) ? relation[0] : relation
  if (!appointment?.pets) return '未登録'
  return getRelatedValue(appointment.pets, 'name')
}

export default async function VisitsPage({ searchParams }: VisitsPageProps) {
  const resolvedSearchParams = await searchParams
  const requestedTab = resolvedSearchParams?.tab
  const activeTab: ActiveTab =
    requestedTab === 'revisit' ||
    requestedTab === 'followup' ||
    requestedTab === 'cycle' ||
    requestedTab === 'quality'
      ? requestedTab
      : 'list'
  const isCreateModalOpen =
    activeTab === 'list' &&
    (resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new')
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/visits?tab=${activeTab}`
  const now = new Date()
  const nowMs = now.getTime()
  const nowIso = now.toISOString()
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: visits } = await supabase
    .from('visits')
    .select(
      'id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes, customers(full_name), appointments(id, pets(name)), staffs(full_name), visit_menus(menu_name, price, duration)'
    )
    .eq('store_id', storeId)
    .order('visit_date', { ascending: false })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id')
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })

  const { data: staffs } = await supabase
    .from('staffs')
    .select('id, user_id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: pets } = await supabase
    .from('pets')
    .select('id, name')
    .eq('store_id', storeId)

  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: revisitRows }, { data: followupTasks }, { data: qualityAppointments }] =
    await Promise.all([
      supabase
        .from('completed_appointment_revisit_source_v')
        .select('appointment_id, customer_id, pet_id, start_time, has_next_booking, is_revisit_leak')
        .eq('store_id', storeId)
        .gte('start_time', thirtyDaysAgo),
      supabase
        .from('customer_followup_tasks')
        .select('id, status, assigned_user_id, recommended_at, resolved_at')
        .eq('store_id', storeId)
        .gte('recommended_at', thirtyDaysAgo),
      supabase
        .from('appointments')
        .select('id, start_time, checked_in_at, status')
        .eq('store_id', storeId)
        .gte('start_time', thirtyDaysAgo)
        .not('start_time', 'is', null),
    ])

  const { data: editVisit } = editId
    ? await supabase
        .from('visits')
        .select(
          'id, customer_id, appointment_id, staff_id, visit_date, menu, total_amount, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const visitList = visits ?? []
  const customerOptions: CustomerOption[] = customers ?? []
  const customerNameById = new Map(customerOptions.map((customer) => [customer.id, customer.full_name]))
  const petNameById = new Map((pets ?? []).map((pet) => [pet.id, pet.name]))
  const occupiedAppointmentIds = new Set(
    visitList.map((visit) => visit.appointment_id).filter((value): value is string => Boolean(value))
  )
  const appointmentOptions: AppointmentOption[] = (appointments ?? []).filter((appointment) => {
    return appointment.id === (editVisit?.appointment_id ?? null) || !occupiedAppointmentIds.has(appointment.id)
  })
  const staffOptions: StaffOption[] = (staffs ?? []).map((staff) => ({ id: staff.id, full_name: staff.full_name }))

  const revisitSourceRows =
    (revisitRows as Array<{
      appointment_id: string
      customer_id: string
      pet_id: string
      start_time: string
      has_next_booking: boolean
      is_revisit_leak: boolean
    }> | null) ?? []
  const revisitCompletedCount = revisitSourceRows.length
  const revisitNextBookedCount = revisitSourceRows.filter((row) => row.has_next_booking).length
  const revisitLeakCount = revisitSourceRows.filter((row) => row.is_revisit_leak).length
  const revisitLeakRows = revisitSourceRows
    .filter((row) => row.is_revisit_leak)
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1))
    .slice(0, 10)

  const followupRows =
    (followupTasks as Array<{
      id: string
      status: string
      assigned_user_id: string | null
      recommended_at: string
      resolved_at: string | null
    }> | null) ?? []
  const followupBookedCount = followupRows.filter((row) => row.status === 'resolved_booked').length
  const followupResolvedRows = followupRows.filter((row) => row.status.startsWith('resolved_'))
  const followupOverdueOpenCount = followupRows.filter((row) => {
    if (!['open', 'in_progress', 'snoozed'].includes(row.status)) return false
    return new Date(row.recommended_at).getTime() < nowMs
  }).length
  const staffNameByUserId = new Map(
    (staffs ?? [])
      .filter((staff) => Boolean(staff.user_id))
      .map((staff) => [staff.user_id as string, staff.full_name])
  )
  const followupByAssignee = new Map<string, { name: string; total: number; booked: number }>()
  followupResolvedRows.forEach((row) => {
    const key = row.assigned_user_id ?? 'unassigned'
    const current = followupByAssignee.get(key) ?? {
      name: row.assigned_user_id ? staffNameByUserId.get(row.assigned_user_id) ?? '不明' : '未割当',
      total: 0,
      booked: 0,
    }
    current.total += 1
    if (row.status === 'resolved_booked') current.booked += 1
    followupByAssignee.set(key, current)
  })
  const followupAssigneeRows = Array.from(followupByAssignee.values())
    .sort((a, b) => {
      const aRate = percent(a.booked, a.total)
      const bRate = percent(b.booked, b.total)
      if (bRate !== aRate) return bRate - aRate
      return b.booked - a.booked
    })
    .slice(0, 5)

  const visitDatesByCustomer = new Map<string, string[]>()
  visitList.forEach((visit) => {
    if (!visit.customer_id) return
    const current = visitDatesByCustomer.get(visit.customer_id) ?? []
    current.push(visit.visit_date)
    visitDatesByCustomer.set(visit.customer_id, current)
  })
  const cycleIntervals: number[] = []
  const longGapCustomers: Array<{ customerId: string; customerName: string; days: number }> = []
  visitDatesByCustomer.forEach((dates, customerId) => {
    const sorted = dates.slice().sort((a, b) => (a < b ? -1 : 1))
    for (let i = 1; i < sorted.length; i += 1) {
      cycleIntervals.push(diffDays(sorted[i], sorted[i - 1]))
    }
    const lastVisit = sorted[sorted.length - 1]
    const daysSinceLastVisit = diffDays(nowIso, lastVisit)
    if (daysSinceLastVisit >= 45) {
      longGapCustomers.push({
        customerId,
        customerName: customerNameById.get(customerId) ?? '未登録',
        days: daysSinceLastVisit,
      })
    }
  })
  longGapCustomers.sort((a, b) => b.days - a.days)
  const cycleBucket = {
    within30: cycleIntervals.filter((days) => days <= 30).length,
    within45: cycleIntervals.filter((days) => days >= 31 && days <= 45).length,
    within60: cycleIntervals.filter((days) => days >= 46 && days <= 60).length,
    over60: cycleIntervals.filter((days) => days >= 61).length,
  }

  const qualityRows =
    (qualityAppointments as Array<{
      id: string
      start_time: string
      checked_in_at: string | null
      status: string
    }> | null) ?? []
  const hourlyQuality = new Map<number, { total: number; delayed: number; noShow: number }>()
  qualityRows.forEach((row) => {
    const hour = toJstHour(row.start_time)
    if (hour < 0 || row.status === 'キャンセル') return
    const current = hourlyQuality.get(hour) ?? { total: 0, delayed: 0, noShow: 0 }
    current.total += 1
    if (row.status === '無断キャンセル') {
      current.noShow += 1
    }
    if (row.checked_in_at) {
      const delayMin = Math.round(
        (new Date(row.checked_in_at).getTime() - new Date(row.start_time).getTime()) / (60 * 1000)
      )
      if (delayMin >= 15) current.delayed += 1
    }
    hourlyQuality.set(hour, current)
  })
  const qualityHotspots = Array.from(hourlyQuality.entries())
    .map(([hour, value]) => ({
      hour,
      total: value.total,
      delayed: value.delayed,
      noShow: value.noShow,
      delayRate: percent(value.delayed, value.total),
      noShowRate: percent(value.noShow, value.total),
    }))
    .filter((row) => row.total >= 3)
    .sort((a, b) => {
      if (b.delayRate !== a.delayRate) return b.delayRate - a.delayRate
      return b.noShowRate - a.noShowRate
    })
    .slice(0, 8)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">来店履歴</h1>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/visits?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          来店一覧
        </Link>
        <Link
          href="/visits?tab=revisit"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'revisit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          再来店漏れ
        </Link>
        <Link
          href="/visits?tab=followup"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'followup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          フォロー効果
        </Link>
        <Link
          href="/visits?tab=cycle"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'cycle' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          来店周期
        </Link>
        <Link
          href="/visits?tab=quality"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'quality' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          時間帯品質
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">来店一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {visitList.length} 件</p>
              <Link
                href="/visits?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {visitList.length === 0 ? (
            <p className="text-sm text-gray-500">来店履歴がまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visitList.map((visit) => (
                  <article key={visit.id} className="rounded border p-3 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {getRelatedValue(visit.customers, 'full_name')} / {getVisitPetName(visit.appointments)}
                    </p>
                    <p>予約ID: {visit.appointment_id ?? 'なし'}</p>
                    <p>担当: {getRelatedValue(visit.staffs, 'full_name')}</p>
                    <p>来店日時: {formatDateTimeJst(visit.visit_date)}</p>
                    <p>メニュー: {visit.menu}</p>
                    <p>
                      内訳:{' '}
                      {visit.visit_menus && visit.visit_menus.length > 0
                        ? visit.visit_menus.map((menu) => menu.menu_name).join(' / ')
                        : '未登録'}
                    </p>
                    <p>金額: {visit.total_amount.toLocaleString()} 円</p>
                    <p>備考: {visit.notes ?? '未登録'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/visits?tab=list&edit=${visit.id}`} className="text-blue-600 text-sm">
                        編集
                      </Link>
                      <form action={`/api/visits/${visit.id}`} method="post">
                        <input type="hidden" name="_method" value="delete" />
                        <Button type="submit" className="bg-red-500 hover:bg-red-600">
                          削除
                        </Button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm text-left">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2 px-2">顧客</th>
                      <th className="py-2 px-2">ペット</th>
                      <th className="py-2 px-2">予約ID</th>
                      <th className="py-2 px-2">担当</th>
                      <th className="py-2 px-2">来店日時</th>
                      <th className="py-2 px-2">メニュー</th>
                      <th className="py-2 px-2">内訳</th>
                      <th className="py-2 px-2">金額</th>
                      <th className="py-2 px-2">備考</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visitList.map((visit) => (
                      <tr key={visit.id} className="text-gray-700">
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {getRelatedValue(visit.customers, 'full_name')}
                        </td>
                        <td className="py-3 px-2">{getVisitPetName(visit.appointments)}</td>
                        <td className="py-3 px-2">{visit.appointment_id ?? 'なし'}</td>
                        <td className="py-3 px-2">{getRelatedValue(visit.staffs, 'full_name')}</td>
                        <td className="py-3 px-2">{formatDateTimeJst(visit.visit_date)}</td>
                        <td className="py-3 px-2">{visit.menu}</td>
                        <td className="py-3 px-2">
                          {visit.visit_menus && visit.visit_menus.length > 0
                            ? visit.visit_menus.map((menu) => menu.menu_name).join(' / ')
                            : '未登録'}
                        </td>
                        <td className="py-3 px-2">{visit.total_amount.toLocaleString()} 円</td>
                        <td className="py-3 px-2">{visit.notes ?? '未登録'}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/visits?tab=list&edit=${visit.id}`}
                              className="text-blue-600 text-sm"
                            >
                              編集
                            </Link>
                            <form action={`/api/visits/${visit.id}`} method="post">
                              <input type="hidden" name="_method" value="delete" />
                              <Button type="submit" className="bg-red-500 hover:bg-red-600">
                                削除
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {activeTab === 'revisit' ? (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">再来店漏れ分析（直近30日完了分）</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">完了件数</p>
              <p className="text-xl font-semibold text-gray-900">{revisitCompletedCount} 件</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">次回予約化率</p>
              <p className="text-xl font-semibold text-emerald-700">
                {percent(revisitNextBookedCount, revisitCompletedCount)}%
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">再来店漏れ率（45日基準）</p>
              <p className="text-xl font-semibold text-rose-700">
                {percent(revisitLeakCount, revisitCompletedCount)}%
              </p>
            </div>
          </div>
          <div className="mt-5 rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">優先フォロー対象（漏れ上位10件）</p>
              <Link href="/customers" className="text-sm font-semibold text-blue-600">
                再来店フォローへ
              </Link>
            </div>
            {revisitLeakRows.length === 0 ? (
              <p className="text-sm text-gray-500">対象はありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="py-2 px-2">顧客</th>
                      <th className="py-2 px-2">ペット</th>
                      <th className="py-2 px-2">前回来店日</th>
                      <th className="py-2 px-2">経過日数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {revisitLeakRows.map((row) => (
                      <tr key={row.appointment_id}>
                        <td className="py-2 px-2">{customerNameById.get(row.customer_id) ?? '未登録'}</td>
                        <td className="py-2 px-2">{petNameById.get(row.pet_id) ?? '未登録'}</td>
                        <td className="py-2 px-2">{formatDateJst(row.start_time)}</td>
                        <td className="py-2 px-2">{diffDays(nowIso, row.start_time)} 日</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'followup' ? (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">フォロー効果分析（直近30日）</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">フォロー起票数</p>
              <p className="text-xl font-semibold text-gray-900">{followupRows.length} 件</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">予約化率（全体）</p>
              <p className="text-xl font-semibold text-emerald-700">
                {percent(followupBookedCount, followupRows.length)}%
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">期限超過の未解決件数</p>
              <p className="text-xl font-semibold text-rose-700">{followupOverdueOpenCount} 件</p>
            </div>
          </div>
          <div className="mt-5 rounded border p-3">
            <p className="mb-2 text-sm font-semibold text-gray-900">担当者別の予約化率（解決済みのみ）</p>
            {followupAssigneeRows.length === 0 ? (
              <p className="text-sm text-gray-500">解決済みタスクがまだありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="py-2 px-2">担当者</th>
                      <th className="py-2 px-2">予約化</th>
                      <th className="py-2 px-2">解決数</th>
                      <th className="py-2 px-2">予約化率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {followupAssigneeRows.map((row) => (
                      <tr key={row.name}>
                        <td className="py-2 px-2">{row.name}</td>
                        <td className="py-2 px-2">{row.booked} 件</td>
                        <td className="py-2 px-2">{row.total} 件</td>
                        <td className="py-2 px-2">{percent(row.booked, row.total)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'cycle' ? (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">来店周期分析</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">30日以内</p>
              <p className="text-xl font-semibold text-gray-900">{cycleBucket.within30}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">31-45日</p>
              <p className="text-xl font-semibold text-gray-900">{cycleBucket.within45}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">46-60日</p>
              <p className="text-xl font-semibold text-gray-900">{cycleBucket.within60}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-gray-500">61日以上</p>
              <p className="text-xl font-semibold text-rose-700">{cycleBucket.over60}</p>
            </div>
          </div>
          <div className="mt-5 rounded border p-3">
            <p className="mb-2 text-sm font-semibold text-gray-900">45日以上来店がない顧客（上位10件）</p>
            {longGapCustomers.length === 0 ? (
              <p className="text-sm text-gray-500">対象はありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="py-2 px-2">顧客</th>
                      <th className="py-2 px-2">最終来店からの経過</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {longGapCustomers.slice(0, 10).map((row) => (
                      <tr key={row.customerId}>
                        <td className="py-2 px-2">{row.customerName}</td>
                        <td className="py-2 px-2">{row.days} 日</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'quality' ? (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">時間帯品質分析（直近30日）</h2>
          <p className="mt-2 text-sm text-gray-500">
            遅延率は「15分以上遅れて受付」の割合です。件数3件以上の時間帯のみ表示します。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="py-2 px-2">時間帯</th>
                  <th className="py-2 px-2">対象件数</th>
                  <th className="py-2 px-2">遅延件数</th>
                  <th className="py-2 px-2">遅延率</th>
                  <th className="py-2 px-2">無断キャンセル件数</th>
                  <th className="py-2 px-2">無断キャンセル率</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {qualityHotspots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 px-2 text-gray-500">
                      分析対象データが不足しています。
                    </td>
                  </tr>
                ) : (
                  qualityHotspots.map((row) => (
                    <tr key={row.hour}>
                      <td className="py-2 px-2">{row.hour}:00</td>
                      <td className="py-2 px-2">{row.total} 件</td>
                      <td className="py-2 px-2">{row.delayed} 件</td>
                      <td className="py-2 px-2">{row.delayRate}%</td>
                      <td className="py-2 px-2">{row.noShow} 件</td>
                      <td className="py-2 px-2">{row.noShowRate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {isCreateModalOpen || editVisit ? (
        <FormModal
          title={editVisit ? '来店履歴の更新' : '新規来店登録'}
          closeRedirectTo={modalCloseRedirect}
          description="来店履歴はモーダルで入力します。"
          reopenLabel="来店モーダルを開く"
        >
          <form
            action={editVisit ? `/api/visits/${editVisit.id}` : '/api/visits'}
            method="post"
            className="space-y-4"
          >
            {editVisit && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-gray-700">
                顧客
                <select
                  name="customer_id"
                  required
                  defaultValue={editVisit?.customer_id ?? ''}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                予約ID (任意)
                <select
                  name="appointment_id"
                  defaultValue={editVisit?.appointment_id ?? ''}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="">予約なし</option>
                  {appointmentOptions.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {appointment.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                担当スタッフ
                <select
                  name="staff_id"
                  required
                  defaultValue={editVisit?.staff_id ?? ''}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                来店日時
                <Input
                  type="datetime-local"
                  name="visit_date"
                  required
                  defaultValue={toDateTimeLocalValue(editVisit?.visit_date)}
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                施術メニュー
                <Input
                  name="menu"
                  required
                  defaultValue={editVisit?.menu ?? ''}
                  placeholder="シャンプー + カット"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                合計金額
                <Input
                  type="number"
                  name="total_amount"
                  required
                  defaultValue={editVisit?.total_amount?.toString() ?? ''}
                  placeholder="8500"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                備考
                <Input
                  name="notes"
                  defaultValue={editVisit?.notes ?? ''}
                  placeholder="連絡事項など"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">{editVisit ? '更新する' : '登録する'}</Button>
              {editVisit && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </FormModal>
      ) : null}
    </section>
  )
}
