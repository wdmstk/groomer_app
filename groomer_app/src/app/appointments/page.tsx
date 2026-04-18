import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { AppointmentCalendar } from '@/components/appointments/AppointmentCalendar'
import { AppointmentCreateModal } from '@/components/appointments/AppointmentCreateModal'
import { appointmentsPageFixtures } from '@/lib/e2e/appointments-page-fixtures'
import {
  formatAppointmentDateTimeJst,
  getAppointmentNextStatusAction,
  getAppointmentRelatedValue,
  getAppointmentStatusTransitionTime,
  isAppointmentCompletedStatus,
} from '@/lib/appointments/presentation'
import {
  DEFAULT_RESERVATION_PAYMENT_SETTINGS,
  getReservationPaymentBadge,
} from '@/lib/appointments/reservation-payment'
import type { DisplayDelayAlert } from '@/lib/appointments/calendar-presentation'
import { buildPublicReservePath } from '@/lib/public-reservations/presentation'

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

type AppointmentConsentRow = {
  id: string
  appointment_id: string | null
  status: string | null
  pdf_path: string | null
  created_at: string
}

type AppointmentsPageProps = {
  searchParams?: Promise<{
    tab?: string
    list_q?: string
    show_all?: string
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
    delay_alert_fixture?: string
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

function toCompactConsentActionLabel(actionLabel: string) {
  if (actionLabel === '同意書を作成') return '同意書作成'
  if (actionLabel === 'PDF表示') return '同意書PDF'
  return actionLabel
}

function toCompactStatusActionLabel(actionLabel: string) {
  if (actionLabel === '受付') return '受付開始'
  return actionLabel
}

function buildConsentSummary(appointmentId: string, latestConsent: AppointmentConsentRow | null) {
  if (!latestConsent) {
    return {
      badgeLabel: '未作成',
      badgeTone: 'bg-gray-100 text-gray-700',
      actionLabel: '同意書を作成',
      actionHref: `/consents?mode=customer-ops&tab=create-document&appointment_id=${appointmentId}`,
      actionClass: 'text-indigo-700 text-sm',
      openInNewTab: false,
    }
  }

  if (latestConsent.status === 'signed' && latestConsent.pdf_path) {
    return {
      badgeLabel: '署名済み',
      badgeTone: 'bg-emerald-100 text-emerald-700',
      actionLabel: 'PDF表示',
      actionHref: `/api/consents/documents/${latestConsent.id}/pdf?redirect=1`,
      actionClass: 'text-emerald-700 text-sm',
      openInNewTab: true,
    }
  }

  return {
    badgeLabel: '未署名',
    badgeTone: 'bg-rose-100 text-rose-700',
    actionLabel: '同意書を作成',
    actionHref: `/consents?mode=customer-ops&tab=create-document&appointment_id=${appointmentId}`,
    actionClass: 'text-indigo-700 text-sm',
    openInNewTab: false,
  }
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

const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab =
    resolvedSearchParams?.tab === 'calendar'
      ? 'calendar'
      : 'list'
  const listQuery = (resolvedSearchParams?.list_q ?? '').trim()
  const showAllAppointments = resolvedSearchParams?.show_all === '1'
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
  const delayAlertFixture = resolvedSearchParams?.delay_alert_fixture
  const modalCloseRedirect = `/appointments?tab=${activeTab}`
  const defaultDateTimeRange = getDefaultDateTimeRangeJst()
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: appointmentsPageFixtures.storeId }
    : await createStoreScopedClient()
  const publicReservePath = buildPublicReservePath(storeId)
  const db = supabase as NonNullable<typeof supabase>

  const appointments = isPlaywrightE2E
    ? appointmentsPageFixtures.appointments
    : (
        await db
          .from('appointments')
          .select(
            'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, checked_in_at, in_service_at, payment_waiting_at, completed_at, reservation_payment_method, reservation_payment_status, customers(full_name), pets(name), staffs(full_name)'
          )
          .eq('store_id', storeId)
          .order('start_time', { ascending: false })
      ).data

  const customers = isPlaywrightE2E
    ? appointmentsPageFixtures.customers
    : (
        await db
          .from('customers')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const pets = isPlaywrightE2E
    ? appointmentsPageFixtures.pets
    : (
        await db
          .from('pets')
          .select('id, name, customer_id')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const staffs = isPlaywrightE2E
    ? appointmentsPageFixtures.staffs
    : (
        await db
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const calendarDisplaySettings = isPlaywrightE2E
    ? appointmentsPageFixtures.storeSettings
    : (() => {
        return Promise.all([
          db
            .from('stores')
            .select('public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst')
            .eq('id', storeId)
            .maybeSingle(),
          db
            .from('store_customer_management_settings' as never)
            .select('calendar_expand_out_of_range_appointments')
            .eq('store_id', storeId)
            .maybeSingle(),
        ]).then(([storeQuery, customerMgmtQuery]) => ({
          public_reserve_business_start_hour_jst:
            Number(storeQuery.data?.public_reserve_business_start_hour_jst ?? 9) || 9,
          public_reserve_business_end_hour_jst:
            Number(storeQuery.data?.public_reserve_business_end_hour_jst ?? 19) || 19,
          calendar_expand_out_of_range_appointments:
            (customerMgmtQuery.data as { calendar_expand_out_of_range_appointments?: boolean | null } | null)
              ?.calendar_expand_out_of_range_appointments === true,
        }))
      })()
  const resolvedCalendarDisplaySettings = await calendarDisplaySettings

  const editAppointment =
    !editId || isPlaywrightE2E
      ? null
      : (
          await db
            .from('appointments')
            .select(
              'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, reservation_payment_method'
            )
            .eq('id', editId)
            .eq('store_id', storeId)
            .single()
        ).data

  const reservationPaymentSettings = isPlaywrightE2E
    ? DEFAULT_RESERVATION_PAYMENT_SETTINGS
    : (
        await db
          .from('store_reservation_payment_settings')
          .select(
            'prepayment_enabled, card_hold_enabled, cancellation_day_before_percent, cancellation_same_day_percent, cancellation_no_show_percent, no_show_charge_mode'
          )
          .eq('store_id', storeId)
          .maybeSingle()
      ).data ?? DEFAULT_RESERVATION_PAYMENT_SETTINGS

  const menuSelections =
    !editId
      ? []
      : isPlaywrightE2E
        ? appointmentsPageFixtures.appointmentMenus.filter((menu) => menu.appointment_id === editId)
        : (
            await db
              .from('appointment_menus')
              .select('menu_id')
              .eq('appointment_id', editId)
              .eq('store_id', storeId)
          ).data ?? []

  const serviceMenus = isPlaywrightE2E
    ? appointmentsPageFixtures.serviceMenus
    : (
        await db
          .from('service_menus')
          .select('id, name, price, duration, tax_rate, tax_included, is_active')
          .eq('store_id', storeId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false })
      ).data

  const appointmentList = appointments ?? []
  const normalizedListQuery = listQuery.toLowerCase()
  const filteredAppointmentList = appointmentList.filter((appointment) => {
    const status = appointment.status ?? '予約済'
    const isCanceled = status === 'キャンセル' || status === '無断キャンセル'
    const isCompleted = isAppointmentCompletedStatus(status)
    if (!showAllAppointments && (isCanceled || isCompleted)) {
      return false
    }

    if (!normalizedListQuery) {
      return true
    }

    const customerName = getAppointmentRelatedValue(appointment.customers, 'full_name').toLowerCase()
    const petName = getAppointmentRelatedValue(appointment.pets, 'name').toLowerCase()
    const staffName = getAppointmentRelatedValue(appointment.staffs, 'full_name').toLowerCase()
    return (
      customerName.includes(normalizedListQuery) ||
      petName.includes(normalizedListQuery) ||
      staffName.includes(normalizedListQuery)
    )
  })
  const customerNoShowCounts = appointmentList.reduce(
    (acc, appointment) => {
      if (appointment.customer_id && appointment.status === '無断キャンセル') {
        acc[appointment.customer_id] = (acc[appointment.customer_id] ?? 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )
  const customerOptions: CustomerOption[] = Array.from(customers ?? [])
  const petOptions: PetOption[] = Array.from(pets ?? [])
  const staffOptions: StaffOption[] = Array.from(staffs ?? [])
  const menuOptions: ServiceMenuOption[] = Array.from(serviceMenus ?? [])
  const defaultMenuIds = ((menuSelections ?? []) as { menu_id: string }[])
    .map((menu) => menu.menu_id?.trim())
    .filter(Boolean) as string[]
  const appointmentIds = appointmentList.map((appointment) => appointment.id)
  const appointmentMenuRows =
    appointmentIds.length === 0
      ? ([] as { appointment_id: string; menu_id: string }[])
      : isPlaywrightE2E
        ? appointmentsPageFixtures.appointmentMenus.filter((row) =>
            appointmentIds.includes(row.appointment_id)
          )
        : (
            await db
              .from('appointment_menus')
              .select('appointment_id, menu_id')
              .eq('store_id', storeId)
              .in('appointment_id', appointmentIds)
          ).data ?? []
  const appointmentConsentRows =
    appointmentIds.length === 0
      ? ([] as AppointmentConsentRow[])
      : isPlaywrightE2E
        ? appointmentsPageFixtures.consents.filter((row) =>
            appointmentIds.includes(String(row.appointment_id ?? ''))
          )
        : (
            await db
              .from('consent_documents' as never)
              .select('id, appointment_id, status, pdf_path, created_at')
              .eq('store_id', storeId)
              .in('appointment_id', appointmentIds)
          ).data ?? []

  const latestConsentByAppointmentId = new Map<string, AppointmentConsentRow>()
  ;(appointmentConsentRows as AppointmentConsentRow[]).forEach((row) => {
    if (!row.appointment_id) return
    const current = latestConsentByAppointmentId.get(row.appointment_id)
    if (!current) {
      latestConsentByAppointmentId.set(row.appointment_id, row)
      return
    }
    const currentTime = new Date(current.created_at).getTime()
    const nextTime = new Date(row.created_at).getTime()
    if (Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime > currentTime)) {
      latestConsentByAppointmentId.set(row.appointment_id, row)
    }
  })

  const consentSummaryByAppointmentId = new Map(
    appointmentList.map((appointment) => [
      appointment.id,
      buildConsentSummary(appointment.id, latestConsentByAppointmentId.get(appointment.id) ?? null),
    ])
  )
  const appointmentMenuMap = new Map<string, string[]>()
  appointmentMenuRows.forEach((row) => {
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
    customerName: getAppointmentRelatedValue(appointment.customers, 'full_name'),
    petName: getAppointmentRelatedValue(appointment.pets, 'name'),
    staffId: appointment.staff_id,
    staffName: getAppointmentRelatedValue(appointment.staffs, 'full_name'),
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
  const initialDelayAlert: DisplayDelayAlert | null =
    isPlaywrightE2E && delayAlertFixture === '1'
      ? {
          baseEndTime: '2026-03-16T02:00:00.000Z',
          lines: ['+15分: 2件影響 (11:15 モカ (山田 花子))'],
        }
      : null

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">予約管理</h1>
          <p className="text-xs text-gray-500">
            店舗共通の新規顧客向け予約フォーム:
            {' '}
            <Link href={publicReservePath} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
              {publicReservePath}
            </Link>
          </p>
        </div>
        <Link
          href={publicReservePath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center rounded border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          公開予約フォームを開く
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <Link
            href="/appointments?tab=list"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              activeTab === 'list' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            予約一覧
          </Link>
          <Link
            href="/appointments?tab=calendar"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              activeTab === 'calendar' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            カレンダー
          </Link>
        </div>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">予約一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">
                表示 {filteredAppointmentList.length} / 全 {appointmentList.length} 件
              </p>
              <Link
                href="/appointments?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          <form
            action="/appointments"
            method="get"
            className="mb-4 grid grid-cols-1 gap-2 rounded border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_auto_auto]"
          >
            <input type="hidden" name="tab" value="list" />
            <input
              type="text"
              name="list_q"
              defaultValue={listQuery}
              placeholder="顧客・ペット・担当で検索"
              className="h-9 rounded border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            <label className="inline-flex h-9 items-center gap-2 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                name="show_all"
                value="1"
                defaultChecked={showAllAppointments}
                className="h-4 w-4"
              />
              全表示
            </label>
            <Button type="submit">適用</Button>
          </form>
          {filteredAppointmentList.length === 0 ? (
            <p className="text-sm text-gray-500">
              {appointmentList.length === 0
                ? '予約がまだ登録されていません。'
                : '条件に一致する予約がありません。'}
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden" data-testid="appointments-list-mobile">
                {filteredAppointmentList.map((appointment) => {
                  const consentSummary = consentSummaryByAppointmentId.get(appointment.id) ?? buildConsentSummary(appointment.id, null)
                  const reservationBadge = getReservationPaymentBadge({
                    method: appointment.reservation_payment_method,
                    status: appointment.reservation_payment_status,
                  })
                  const nextStatusAction = getAppointmentNextStatusAction(appointment.status)
                  const canClaimReservationCharge =
                    appointment.status === '無断キャンセル' &&
                    (appointment.reservation_payment_method === 'prepayment' ||
                      appointment.reservation_payment_method === 'card_hold')
                  const compactConsentActionLabel = toCompactConsentActionLabel(consentSummary.actionLabel)
                  return (
                  <article
                    key={appointment.id}
                    className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700"
                    data-testid={`appointment-row-${appointment.id}`}
                  >
                    <div className="flex items-center gap-2 overflow-x-auto text-sm font-semibold text-gray-900 whitespace-nowrap">
                      <span>{getAppointmentRelatedValue(appointment.customers, 'full_name')}</span>
                      <span className="text-gray-400">/</span>
                      <span>{getAppointmentRelatedValue(appointment.pets, 'name')}</span>
                      <span className="text-gray-400">/</span>
                      <span>{getAppointmentRelatedValue(appointment.staffs, 'full_name')}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                      <p className="whitespace-nowrap">開始: {formatAppointmentDateTimeJst(appointment.start_time)}</p>
                      <p className="whitespace-nowrap">終了: {formatAppointmentDateTimeJst(appointment.end_time)}</p>
                      <p className="truncate">メニュー: {appointment.menu}</p>
                      <p className="whitespace-nowrap">所要時間: {appointment.duration} 分</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {appointment.status ?? '予約済'}
                      </span>
                      {reservationBadge ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${reservationBadge.className}`}>
                          {reservationBadge.label}
                        </span>
                      ) : null}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${consentSummary.badgeTone}`}>
                        同意書: {consentSummary.badgeLabel}
                      </span>
                    </div>
                    {(() => {
                      const transition = getAppointmentStatusTransitionTime(appointment.status, appointment)
                      if (!transition?.value) return null
                      return (
                        <p className="mt-1 text-xs text-gray-500">
                          {transition.label}: {formatAppointmentDateTimeJst(transition.value)}
                        </p>
                      )
                    })()}
                    <p className="mt-1 text-xs text-gray-600">備考: {appointment.notes ?? '未登録'}</p>
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {appointment.status === '予約申請' ? (
                          <form action={`/api/appointments/${appointment.id}/confirm`} method="post" className="justify-self-start">
                            <Button
                              type="submit"
                              className="h-7 whitespace-nowrap bg-emerald-600 px-2 text-xs hover:bg-emerald-700"
                              data-testid={`appointment-confirm-${appointment.id}`}
                            >
                              申請確定
                            </Button>
                          </form>
                        ) : nextStatusAction ? (
                          <form action={`/api/appointments/${appointment.id}/status`} method="post" className="justify-self-start">
                            <input type="hidden" name="next_status" value={nextStatusAction.nextStatus} />
                            <input type="hidden" name="redirect_tab" value="list" />
                            <Button
                              type="submit"
                              className="h-7 whitespace-nowrap bg-indigo-600 px-2 text-xs hover:bg-indigo-700"
                              data-testid={`appointment-status-action-${appointment.id}`}
                            >
                              {toCompactStatusActionLabel(nextStatusAction.label)}
                            </Button>
                          </form>
                        ) : isAppointmentCompletedStatus(appointment.status) ? (
                          <Link
                            href={`/appointments?tab=list&modal=create&followup_from=${appointment.id}`}
                            className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-emerald-300 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            data-testid={`appointment-followup-${appointment.id}`}
                          >
                            次回予約
                          </Link>
                        ) : null}
                      <Link
                        href={`/appointments?tab=list&edit=${appointment.id}`}
                        className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-blue-300 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        編集
                      </Link>
                      <Link
                        href={consentSummary.actionHref}
                        className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-indigo-300 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        target={consentSummary.openInNewTab ? '_blank' : undefined}
                        rel={consentSummary.openInNewTab ? 'noopener noreferrer' : undefined}
                      >
                        {compactConsentActionLabel}
                      </Link>
                      <form action={`/api/appointments/${appointment.id}`} method="post" className="justify-self-start">
                          <input type="hidden" name="_method" value="delete" />
                          <Button type="submit" className="h-7 whitespace-nowrap bg-red-500 px-2 text-xs hover:bg-red-600">
                            削除
                          </Button>
                        </form>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {canClaimReservationCharge ? (
                          <form
                            action={`/api/appointments/${appointment.id}/reservation-payment/claim`}
                            method="post"
                          >
                            <input type="hidden" name="redirect_to" value="/appointments?tab=list" />
                            <Button type="submit" className="h-7 whitespace-nowrap bg-sky-600 px-2 text-xs hover:bg-sky-700">
                              無断CXL請求
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </article>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1160px] w-full table-fixed text-left text-sm" data-testid="appointments-list">
                  <thead className="border-b text-xs text-gray-500">
                    <tr>
                      <th className="w-[29%] px-2 py-1.5">対象</th>
                      <th className="w-[18%] px-2 py-1.5">時間</th>
                      <th className="w-[18%] px-2 py-1.5">メニュー</th>
                      <th className="w-[17%] px-2 py-1.5">状態</th>
                      <th className="w-[18%] px-2 py-1.5">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAppointmentList.map((appointment) => {
                      const consentSummary = consentSummaryByAppointmentId.get(appointment.id) ?? buildConsentSummary(appointment.id, null)
                      const reservationBadge = getReservationPaymentBadge({
                        method: appointment.reservation_payment_method,
                        status: appointment.reservation_payment_status,
                      })
                  const canClaimReservationCharge =
                    appointment.status === '無断キャンセル' &&
                    (appointment.reservation_payment_method === 'prepayment' ||
                      appointment.reservation_payment_method === 'card_hold')
                  const nextStatusAction = getAppointmentNextStatusAction(appointment.status)
                  const compactConsentActionLabel = toCompactConsentActionLabel(consentSummary.actionLabel)
                  return (
                        <tr key={appointment.id} className="align-top text-gray-700" data-testid={`appointment-row-${appointment.id}`}>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1 whitespace-nowrap font-semibold text-gray-900">
                              <span>{getAppointmentRelatedValue(appointment.customers, 'full_name')}</span>
                              <span className="text-gray-400">/</span>
                              <span>{getAppointmentRelatedValue(appointment.pets, 'name')}</span>
                              <span className="text-gray-400">/</span>
                              <span>{getAppointmentRelatedValue(appointment.staffs, 'full_name')}</span>
                            </div>
                            <p className="mt-0.5 max-w-[260px] truncate text-xs text-gray-500">
                              備考: {appointment.notes ?? '未登録'}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-600">
                            <p className="whitespace-nowrap">開始: {formatAppointmentDateTimeJst(appointment.start_time)}</p>
                            <p className="mt-0.5 whitespace-nowrap">終了: {formatAppointmentDateTimeJst(appointment.end_time)}</p>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-600">
                            <p className="max-w-[220px] truncate">メニュー: {appointment.menu}</p>
                            <p className="mt-0.5 whitespace-nowrap">所要時間: {appointment.duration} 分</p>
                          </td>
                          <td className="px-2 py-2">
                            <div className="grid gap-1">
                              <div>
                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                  {appointment.status ?? '予約済'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {reservationBadge ? (
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${reservationBadge.className}`}>
                                    {reservationBadge.label}
                                  </span>
                                ) : null}
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${consentSummary.badgeTone}`}>
                                  同意書: {consentSummary.badgeLabel}
                                </span>
                              </div>
                            </div>
                            {(() => {
                              const transition = getAppointmentStatusTransitionTime(appointment.status, appointment)
                              if (!transition?.value) return null
                              return (
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {transition.label}: {formatAppointmentDateTimeJst(transition.value)}
                                </p>
                              )
                            })()}
                          </td>
                          <td className="px-2 py-2">
                            <div>
                              <div className="grid grid-cols-2 gap-1">
                                {appointment.status === '予約申請' ? (
                                  <form action={`/api/appointments/${appointment.id}/confirm`} method="post" className="justify-self-start">
                                    <Button
                                      type="submit"
                                      className="h-7 whitespace-nowrap bg-emerald-600 px-2 text-xs hover:bg-emerald-700"
                                      data-testid={`appointment-confirm-${appointment.id}`}
                                    >
                                      申請確定
                                    </Button>
                                  </form>
                                ) : nextStatusAction ? (
                                  <form action={`/api/appointments/${appointment.id}/status`} method="post" className="justify-self-start">
                                    <input type="hidden" name="next_status" value={nextStatusAction.nextStatus} />
                                    <input type="hidden" name="redirect_tab" value="list" />
                                    <Button
                                      type="submit"
                                      className="h-7 whitespace-nowrap bg-indigo-600 px-2 text-xs hover:bg-indigo-700"
                                      data-testid={`appointment-status-action-${appointment.id}`}
                                    >
                                      {toCompactStatusActionLabel(nextStatusAction.label)}
                                    </Button>
                                  </form>
                                ) : isAppointmentCompletedStatus(appointment.status) ? (
                                  <Link
                                    href={`/appointments?tab=list&modal=create&followup_from=${appointment.id}`}
                                    className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-emerald-300 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                    data-testid={`appointment-followup-${appointment.id}`}
                                  >
                                    次回予約
                                  </Link>
                                ) : <span />}
                                <Link
                                  href={`/appointments?tab=list&edit=${appointment.id}`}
                                  className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-blue-300 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                  編集
                                </Link>
                                <Link
                                  href={consentSummary.actionHref}
                                  className="inline-flex h-7 w-fit justify-self-start items-center rounded border border-indigo-300 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                                  target={consentSummary.openInNewTab ? '_blank' : undefined}
                                  rel={consentSummary.openInNewTab ? 'noopener noreferrer' : undefined}
                                >
                                  {compactConsentActionLabel}
                                </Link>
                                <form action={`/api/appointments/${appointment.id}`} method="post" className="justify-self-start">
                                  <input type="hidden" name="_method" value="delete" />
                                  <Button type="submit" className="h-7 whitespace-nowrap bg-red-500 px-2 text-xs hover:bg-red-600">
                                    削除
                                  </Button>
                                </form>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {canClaimReservationCharge ? (
                                  <form
                                    action={`/api/appointments/${appointment.id}/reservation-payment/claim`}
                                    method="post"
                                  >
                                    <input type="hidden" name="redirect_to" value="/appointments?tab=list" />
                                    <Button type="submit" className="h-7 whitespace-nowrap bg-sky-600 px-2 text-xs hover:bg-sky-700">
                                      無断CXL請求
                                    </Button>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
            <AppointmentCalendar
              appointments={calendarAppointments}
              initialDelayAlert={initialDelayAlert}
              businessStartHourJst={resolvedCalendarDisplaySettings.public_reserve_business_start_hour_jst}
              businessEndHourJst={resolvedCalendarDisplaySettings.public_reserve_business_end_hour_jst}
              expandTimelineForOutOfRangeAppointments={
                resolvedCalendarDisplaySettings.calendar_expand_out_of_range_appointments
              }
            />
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
          reservationPaymentSettings={reservationPaymentSettings}
        />
      ) : null}
    </section>
  )
}
