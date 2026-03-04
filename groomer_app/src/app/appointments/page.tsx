import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { AppointmentCalendar } from '@/components/appointments/AppointmentCalendar'
import { ReserveUrlCopyButton } from '@/components/ui/ReserveUrlCopyButton'
import { AppointmentCreateModal } from '@/components/appointments/AppointmentCreateModal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CustomerOption = {
  id: string
  full_name: string
}

type PetOption = {
  id: string
  name: string
  customer_id: string
}

type StaffOption = {
  id: string
  full_name: string
}

type ServiceMenuOption = {
  id: string
  name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_active: boolean | null
}

type AppointmentsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
    followup_from?: string
    followup_task_id?: string
    followup_customer_id?: string
    followup_pet_id?: string
    reoffer_customer_id?: string
    reoffer_pet_id?: string
    reoffer_staff_id?: string
    reoffer_start_time?: string
    reoffer_end_time?: string
    reoffer_note?: string
    reoffer_id?: string
  }>
}

const statusOptions = [
  '予約申請',
  '予約済',
  '受付',
  '施術中',
  '会計待ち',
  '完了',
  '来店済',
  'キャンセル',
  '無断キャンセル',
]
const statusFlowActions = {
  予約済: { nextStatus: '受付', label: '受付開始' },
  受付: { nextStatus: '施術中', label: '施術開始' },
  施術中: { nextStatus: '会計待ち', label: '会計待ちへ' },
  会計待ち: { nextStatus: '完了', label: '完了' },
} as const

function isCompletedStatus(status: string | null | undefined) {
  return status === '来店済' || status === '完了'
}

function getNextStatusAction(status: string | null | undefined) {
  if (!status || status === '予約申請') return null
  return statusFlowActions[status as keyof typeof statusFlowActions] ?? null
}

function getRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
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

function getDefaultDateTimeRangeJst() {
  const now = new Date()
  const rounded = new Date(now)
  rounded.setSeconds(0, 0)
  const minute = rounded.getMinutes()
  const remainder = minute % 30
  if (remainder !== 0) {
    rounded.setMinutes(minute + (30 - remainder))
  }
  const end = new Date(rounded.getTime() + 60 * 60 * 1000)

  const format = (date: Date) => {
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

  return {
    start: format(rounded),
    end: format(end),
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
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

function getStatusTransitionTime(
  status: string | null | undefined,
  appointment: {
    checked_in_at?: string | null
    in_service_at?: string | null
    payment_waiting_at?: string | null
    completed_at?: string | null
  }
) {
  if (status === '受付') return { label: '受付', value: appointment.checked_in_at ?? null }
  if (status === '施術中') return { label: '施術開始', value: appointment.in_service_at ?? null }
  if (status === '会計待ち') return { label: '会計待ち', value: appointment.payment_waiting_at ?? null }
  if (isCompletedStatus(status)) return { label: '完了', value: appointment.completed_at ?? null }
  return null
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab =
    resolvedSearchParams?.tab === 'calendar'
      ? 'calendar'
      : 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const followupFromId = resolvedSearchParams?.followup_from
  const followupTaskId = resolvedSearchParams?.followup_task_id
  const followupCustomerId = resolvedSearchParams?.followup_customer_id
  const followupPetId = resolvedSearchParams?.followup_pet_id
  const reofferCustomerId = resolvedSearchParams?.reoffer_customer_id
  const reofferPetId = resolvedSearchParams?.reoffer_pet_id
  const reofferStaffId = resolvedSearchParams?.reoffer_staff_id
  const reofferStartTime = resolvedSearchParams?.reoffer_start_time
  const reofferEndTime = resolvedSearchParams?.reoffer_end_time
  const reofferNote = resolvedSearchParams?.reoffer_note
  const reofferId = resolvedSearchParams?.reoffer_id
  const modalCloseRedirect = `/appointments?tab=${activeTab}`
  const defaultDateTimeRange = getDefaultDateTimeRangeJst()
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, checked_in_at, in_service_at, payment_waiting_at, completed_at, customers(full_name), pets(name), staffs(full_name)'
    )
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: pets } = await supabase
    .from('pets')
    .select('id, name, customer_id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: staffs } = await supabase
    .from('staffs')
    .select('id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: editAppointment } = editId
    ? await supabase
        .from('appointments')
        .select(
          'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const { data: menuSelections } = editId
    ? await supabase
        .from('appointment_menus')
        .select('menu_id')
        .eq('appointment_id', editId)
        .eq('store_id', storeId)
    : { data: [] }

  const { data: serviceMenus } = await supabase
    .from('service_menus')
    .select('id, name, price, duration, tax_rate, tax_included, is_active')
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  const appointmentList = appointments ?? []
  const customerNoShowCounts = appointmentList.reduce(
    (acc, appointment) => {
      if (appointment.customer_id && appointment.status === '無断キャンセル') {
        acc[appointment.customer_id] = (acc[appointment.customer_id] ?? 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )
  const customerOptions: CustomerOption[] = customers ?? []
  const petOptions: PetOption[] = pets ?? []
  const staffOptions: StaffOption[] = staffs ?? []
  const menuOptions: ServiceMenuOption[] = serviceMenus ?? []
  const defaultMenuIds = ((menuSelections ?? []) as { menu_id: string }[])
    .map((menu) => menu.menu_id?.trim())
    .filter(Boolean) as string[]
  const appointmentIds = appointmentList.map((appointment) => appointment.id)
  const { data: appointmentMenuRows } =
    appointmentIds.length > 0
      ? await supabase
          .from('appointment_menus')
          .select('appointment_id, menu_id')
          .eq('store_id', storeId)
          .in('appointment_id', appointmentIds)
      : { data: [] as { appointment_id: string; menu_id: string }[] }
  const appointmentMenuMap = new Map<string, string[]>()
  ;(appointmentMenuRows ?? []).forEach((row) => {
    const list = appointmentMenuMap.get(row.appointment_id) ?? []
    list.push(row.menu_id)
    appointmentMenuMap.set(row.appointment_id, list)
  })
  const templates = appointmentList.map((appointment) => ({
    id: appointment.id,
    customer_id: appointment.customer_id,
    pet_id: appointment.pet_id,
    staff_id: appointment.staff_id,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    notes: appointment.notes,
    menu_ids: appointmentMenuMap.get(appointment.id) ?? [],
    duration: appointment.duration,
    status: appointment.status,
  }))
  const calendarAppointments = appointmentList.map((appointment) => ({
    id: appointment.id,
    customerName: getRelatedValue(appointment.customers, 'full_name'),
    petName: getRelatedValue(appointment.pets, 'name'),
    staffId: appointment.staff_id,
    staffName: getRelatedValue(appointment.staffs, 'full_name'),
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    menu: appointment.menu,
    status: appointment.status ?? '予約済',
  }))

  const followupSource =
    !editId && followupFromId
      ? appointmentList.find((appointment) => appointment.id === followupFromId) ?? null
      : null
  const followupMenuIds = followupSource ? appointmentMenuMap.get(followupSource.id) ?? [] : []
  const followupDuration = Math.max(followupSource?.duration ?? 0, 30)
  const followupStart = (() => {
    if (!followupSource?.start_time) return defaultDateTimeRange.start
    const source = new Date(followupSource.start_time)
    if (Number.isNaN(source.getTime())) return defaultDateTimeRange.start
    return toDateTimeLocalValue(addDays(source, 45).toISOString())
  })()
  const followupEnd = (() => {
    const start = new Date(`${followupStart}:00+09:00`)
    if (Number.isNaN(start.getTime())) return defaultDateTimeRange.end
    return toDateTimeLocalValue(new Date(start.getTime() + followupDuration * 60 * 1000).toISOString())
  })()

  const createDefaultMenuIds = followupSource ? followupMenuIds : defaultMenuIds
  const createDefaultStartTime = followupSource
    ? followupStart
    : reofferStartTime
      ? toDateTimeLocalValue(reofferStartTime)
      : defaultDateTimeRange.start
  const createDefaultEndTime = followupSource
    ? followupEnd
    : reofferEndTime
      ? toDateTimeLocalValue(reofferEndTime)
      : defaultDateTimeRange.end
  const createInitialPrefill =
    followupSource ||
    followupCustomerId ||
    followupPetId ||
    reofferCustomerId ||
    reofferPetId ||
    reofferStaffId
      ? {
          customer_id: followupSource?.customer_id ?? followupCustomerId ?? reofferCustomerId ?? '',
          pet_id: followupSource?.pet_id ?? followupPetId ?? reofferPetId ?? '',
          staff_id: followupSource?.staff_id ?? reofferStaffId ?? '',
          status: '予約済',
          notes: followupSource?.notes ?? reofferNote ?? '',
        }
      : undefined
  const followupRecommendationMessage = followupSource
    ? `次回予約の推奨来店日を自動セットしました（前回から45日後）。`
    : reofferCustomerId
      ? '再販受付済みの顧客情報を引き継いで予約作成を開いています。'
    : undefined

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">予約管理</h1>
          <p className="text-gray-600">予約情報の登録・更新・削除が行えます。</p>
        </div>
        <ReserveUrlCopyButton />
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/appointments?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          予約一覧
        </Link>
        <Link
          href="/appointments?tab=calendar"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'calendar'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          }`}
        >
          カレンダー
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">予約一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {appointmentList.length} 件</p>
              <Link
                href="/appointments?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {appointmentList.length === 0 ? (
            <p className="text-sm text-gray-500">予約がまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {appointmentList.map((appointment) => (
                  <article key={appointment.id} className="rounded border p-3 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {getRelatedValue(appointment.customers, 'full_name')} /{' '}
                      {getRelatedValue(appointment.pets, 'name')}
                    </p>
                    <p>担当: {getRelatedValue(appointment.staffs, 'full_name')}</p>
                    <p>開始: {formatDateTimeJst(appointment.start_time)}</p>
                    <p>終了: {formatDateTimeJst(appointment.end_time)}</p>
                    <p>メニュー: {appointment.menu}</p>
                    <p>所要時間: {appointment.duration} 分</p>
                    <p>ステータス: {appointment.status ?? '予約済'}</p>
                    {(() => {
                      const transition = getStatusTransitionTime(appointment.status, appointment)
                      if (!transition?.value) return null
                      return (
                        <p>
                          {transition.label}: {formatDateTimeJst(transition.value)}
                        </p>
                      )
                    })()}
                    <p>備考: {appointment.notes ?? '未登録'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/appointments?tab=list&edit=${appointment.id}`}
                        className="text-blue-600 text-sm"
                      >
                        編集
                      </Link>
                      {appointment.status === '予約申請' ? (
                        <form action={`/api/appointments/${appointment.id}/confirm`} method="post">
                          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            申請を確定
                          </Button>
                        </form>
                      ) : null}
                      {(() => {
                        const action = getNextStatusAction(appointment.status)
                        if (!action) return null
                        return (
                          <form action={`/api/appointments/${appointment.id}/status`} method="post">
                            <input type="hidden" name="next_status" value={action.nextStatus} />
                            <input type="hidden" name="redirect_tab" value="list" />
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                              {action.label}
                            </Button>
                          </form>
                        )
                      })()}
                      {isCompletedStatus(appointment.status) ? (
                        <Link
                              href={`/appointments?tab=list&modal=create&followup_from=${appointment.id}`}
                              className="text-emerald-700 text-sm"
                            >
                          次回予約
                        </Link>
                      ) : null}
                      <form action={`/api/appointments/${appointment.id}`} method="post">
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
                      <th className="py-2 px-2">担当</th>
                      <th className="py-2 px-2">開始</th>
                      <th className="py-2 px-2">終了</th>
                      <th className="py-2 px-2">メニュー</th>
                      <th className="py-2 px-2">所要時間</th>
                      <th className="py-2 px-2">ステータス</th>
                      <th className="py-2 px-2">備考</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {appointmentList.map((appointment) => (
                      <tr key={appointment.id} className="text-gray-700">
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {getRelatedValue(appointment.customers, 'full_name')}
                        </td>
                        <td className="py-3 px-2">{getRelatedValue(appointment.pets, 'name')}</td>
                        <td className="py-3 px-2">
                          {getRelatedValue(appointment.staffs, 'full_name')}
                        </td>
                        <td className="py-3 px-2">{formatDateTimeJst(appointment.start_time)}</td>
                        <td className="py-3 px-2">{formatDateTimeJst(appointment.end_time)}</td>
                        <td className="py-3 px-2">{appointment.menu}</td>
                        <td className="py-3 px-2">{appointment.duration} 分</td>
                        <td className="py-3 px-2">
                          <p>{appointment.status ?? '予約済'}</p>
                          {(() => {
                            const transition = getStatusTransitionTime(appointment.status, appointment)
                            if (!transition?.value) return null
                            return (
                              <p className="text-xs text-gray-500">
                                {transition.label}: {formatDateTimeJst(transition.value)}
                              </p>
                            )
                          })()}
                        </td>
                        <td className="py-3 px-2">{appointment.notes ?? '未登録'}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/appointments?tab=list&edit=${appointment.id}`}
                              className="text-blue-600 text-sm"
                            >
                              編集
                            </Link>
                            {appointment.status === '予約申請' ? (
                              <form action={`/api/appointments/${appointment.id}/confirm`} method="post">
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                  申請を確定
                                </Button>
                              </form>
                            ) : null}
                            {(() => {
                              const action = getNextStatusAction(appointment.status)
                              if (!action) return null
                              return (
                                <form action={`/api/appointments/${appointment.id}/status`} method="post">
                                  <input type="hidden" name="next_status" value={action.nextStatus} />
                                  <input type="hidden" name="redirect_tab" value="list" />
                                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                                    {action.label}
                                  </Button>
                                </form>
                              )
                            })()}
                            {isCompletedStatus(appointment.status) ? (
                              <Link
                                href={`/appointments?tab=list&modal=create&followup_from=${appointment.id}`}
                                className="text-emerald-700 text-sm"
                              >
                                次回予約
                              </Link>
                            ) : null}
                            <form action={`/api/appointments/${appointment.id}`} method="post">
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
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">予約カレンダー</h2>
            <p className="text-sm text-gray-500">全 {appointmentList.length} 件</p>
          </div>
          {appointmentList.length === 0 ? (
            <p className="text-sm text-gray-500">予約がまだ登録されていません。</p>
          ) : (
            <AppointmentCalendar appointments={calendarAppointments} />
          )}
        </Card>
      )}

      {isCreateModalOpen || editAppointment || followupFromId || reofferCustomerId ? (
        <AppointmentCreateModal
          editAppointment={editAppointment}
          customerOptions={customerOptions}
          petOptions={petOptions}
          staffOptions={staffOptions}
          menuOptions={menuOptions}
          defaultMenuIds={createDefaultMenuIds}
          statusOptions={statusOptions}
          formAction={editAppointment ? `/api/appointments/${editAppointment.id}` : '/api/appointments'}
          defaultStartTime={
            editAppointment
              ? toDateTimeLocalValue(editAppointment.start_time)
              : createDefaultStartTime
          }
          defaultEndTime={
            editAppointment
              ? toDateTimeLocalValue(editAppointment.end_time)
              : createDefaultEndTime
          }
          templates={templates}
          closeRedirectTo={modalCloseRedirect}
          customerNoShowCounts={customerNoShowCounts}
          initialPrefill={!editAppointment ? createInitialPrefill : undefined}
          recommendationMessage={!editAppointment ? followupRecommendationMessage : undefined}
          followupTaskId={!editAppointment ? followupTaskId : undefined}
          reofferId={!editAppointment ? reofferId : undefined}
        />
      ) : null}
    </section>
  )
}
