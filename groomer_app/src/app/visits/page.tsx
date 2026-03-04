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
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const modalCloseRedirect = `/visits?tab=${activeTab}`
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
    .select('id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

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
  const occupiedAppointmentIds = new Set(
    visitList.map((visit) => visit.appointment_id).filter((value): value is string => Boolean(value))
  )
  const appointmentOptions: AppointmentOption[] = (appointments ?? []).filter((appointment) => {
    return appointment.id === (editVisit?.appointment_id ?? null) || !occupiedAppointmentIds.has(appointment.id)
  })
  const staffOptions: StaffOption[] = staffs ?? []

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">来店履歴</h1>
        <p className="text-gray-600">来店履歴の登録・更新・削除が行えます。</p>
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
      </div>

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
