import Link from 'next/link'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { QuickPaymentModal } from '@/components/dashboard/QuickPaymentModal'
import { SlotReofferPanel } from '@/components/dashboard/SlotReofferPanel'
import type { Json } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DashboardPageProps = {
  searchParams?: Promise<{
    followup_window?: string
    tab?: string
  }>
}

type AppointmentRow = {
  id: string
  customer_id: string
  pet_id: string
  staff_id: string
  start_time: string
  end_time: string
  menu: string
  status: string | null
  notes: string | null
  checked_in_at: string | null
  in_service_at: string | null
  payment_waiting_at: string | null
  completed_at: string | null
  customers?:
    | { id: string; full_name: string; phone_number: string | null; email: string | null }
    | { id: string; full_name: string; phone_number: string | null; email: string | null }[]
    | null
  pets?:
    | { id: string; name: string; breed: string | null; gender: string | null; notes: string | null }
    | {
        id: string
        name: string
        breed: string | null
        gender: string | null
        notes: string | null
      }[]
    | null
  staffs?: { id: string; full_name: string } | { id: string; full_name: string }[] | null
}

type MedicalRecordRow = {
  id: string
  pet_id: string
  record_date: string
  menu: string
  skin_condition: string | null
  behavior_notes: string | null
  caution_notes: string | null
}

type AppointmentMenuRow = {
  appointment_id: string
  price: number
  tax_rate: number | null
  tax_included: boolean | null
}

type PaymentRow = {
  id: string
  appointment_id: string
  total_amount: number
  paid_at: string | null
}

type FollowupDashboardRow = {
  id: string
  status: string
  resolved_at: string | null
  due_on: string | null
  recommended_at: string
  resolution_type: string | null
  assigned_user_id: string | null
  assignee_name?: string | null
  customers?: { full_name: string; phone_number: string | null; line_id: string | null } | { full_name: string; phone_number: string | null; line_id: string | null }[] | null
}

type ReofferDashboardRow = {
  id: string
  status: string
  sent_at: string | null
  accepted_at: string | null
  target_staff_id: string | null
}

type ReofferLogDashboardRow = {
  slot_reoffer_id: string | null
  event_type: string
  payload: { [key: string]: Json | undefined } | null
  created_at: string
}

type AppointmentDailySummaryRow = {
  date_key: string
  appointment_count: number
  completed_count: number
  active_appointment_count: number
  requested_count: number
  expected_sales: number | null
}

type PaymentDailySummaryRow = {
  date_key: string
  payment_count: number
  paid_count: number
  confirmed_sales: number | null
}

type VisitDailySummaryRow = {
  date_key: string
  visit_count: number
}

type FollowupDailySummaryRow = {
  date_key: string
  task_count: number
  open_count: number
  in_progress_count: number
  snoozed_count: number
  resolved_booked_count: number
  resolved_no_need_count: number
  resolved_lost_count: number
  due_today_count: number
  touched_count: number
  renotified_count: number
}

type ReofferDailySummaryRow = {
  date_key: string
  total_count: number
  accepted_count: number
  booked_count: number
  phone_contact_count: number
  connected_call_count: number
}

type ServiceMenuInstantRow = {
  id: string
  name: string
  is_active: boolean | null
  is_instant_bookable: boolean | null
}

type PredictiveCustomerDailyFeatureRow = {
  customer_id: string | null
  metric_date_jst: string
  appointments_count: number
  completed_count: number
  canceled_count: number
  no_show_count: number
  latest_start_time: string | null
}

type PredictiveStoreDailyFeatureRow = {
  metric_date_jst: string
  appointments_count: number
  no_show_count: number
}

type DelayFeatureRow = {
  start_time: string
  checked_in_at: string | null
  status: string | null
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const REVISIT_CYCLE_DAYS = 45
const statusFlowActions = {
  予約済: { nextStatus: '受付', label: '受付開始' },
  受付: { nextStatus: '施術中', label: '施術開始' },
  施術中: { nextStatus: '会計待ち', label: '会計待ちへ' },
  会計待ち: { nextStatus: '完了', label: '完了' },
} as const

const dashboardTabs = [
  { id: 'overview', label: '概要' },
  { id: 'operations', label: '当日運用' },
  { id: 'followups', label: '再来店フォロー' },
  { id: 'reoffers', label: '空き枠再販' },
] as const

type DashboardTabId = (typeof dashboardTabs)[number]['id']

function getJstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

function createDateFromJst(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - JST_OFFSET_MS)
}

function addDaysJst(date: Date, days: number) {
  const p = getJstParts(date)
  return createDateFromJst(p.year, p.month, p.day + days, p.hour, p.minute)
}

function getRelatedValue<T extends Record<string, string | null>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.[key] ?? null
  return relation[key] ?? null
}

function formatDateJst(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatTimeJst(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString()} 円`
}

function normalizeDashboardTab(value: string | undefined): DashboardTabId {
  if (dashboardTabs.some((tab) => tab.id === value)) {
    return value as DashboardTabId
  }
  return 'overview'
}

function buildDashboardHref(tab: DashboardTabId, followupWindowDays: number) {
  const params = new URLSearchParams()
  if (tab !== 'overview') {
    params.set('tab', tab)
  }
  params.set('followup_window', String(followupWindowDays))
  return `/dashboard?${params.toString()}`
}

function addDays(value: string, days: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function calculateMenuTotals(rows: AppointmentMenuRow[]) {
  return rows.reduce(
    (acc, row) => {
      const taxRate = row.tax_rate ?? 0.1
      const taxIncluded = row.tax_included ?? true
      const base = taxIncluded ? row.price / (1 + taxRate) : row.price
      const tax = taxIncluded ? row.price - base : row.price * taxRate
      acc.total += base + tax
      return acc
    },
    { total: 0 }
  )
}

function normalizeAppointmentStatus(status: string | null | undefined) {
  if (status === '来店済') return '完了'
  return status ?? '予約済'
}

function getStatusFlowAction(status: string | null | undefined) {
  const normalized = normalizeAppointmentStatus(status)
  return statusFlowActions[normalized as keyof typeof statusFlowActions] ?? null
}

function AppointmentDetailsPanel({
  customerName,
  customerPhone,
  customerEmail,
  customerId,
  petName,
  petBreed,
  petGender,
  petNotes,
  petId,
  latestRecord,
}: {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerId: string
  petName: string
  petBreed: string
  petGender: string
  petNotes: string
  petId: string
  latestRecord: MedicalRecordRow | undefined
}) {
  return (
    <details className="rounded border p-2">
      <summary className="cursor-pointer text-xs text-blue-700">情報を表示</summary>
      <div className="mt-2 space-y-2 text-xs text-gray-700">
        <div>
          <p className="font-semibold text-gray-900">顧客情報</p>
          <p>氏名: {customerName}</p>
          <p>電話: {customerPhone}</p>
          <p>メール: {customerEmail}</p>
          <Link href={`/customers?tab=list&edit=${customerId}`} className="text-blue-700">
            顧客詳細へ
          </Link>
        </div>
        <div>
          <p className="font-semibold text-gray-900">ペット情報</p>
          <p>名前: {petName}</p>
          <p>犬種: {petBreed}</p>
          <p>性別: {petGender}</p>
          <p>注意事項: {petNotes}</p>
          <Link href={`/pets?tab=list&edit=${petId}`} className="text-blue-700">
            ペット詳細へ
          </Link>
        </div>
        <div>
          <p className="font-semibold text-gray-900">最新カルテ情報</p>
          {latestRecord ? (
            <>
              <p>記録日: {formatDateJst(latestRecord.record_date)}</p>
              <p>施術: {latestRecord.menu}</p>
              <p>皮膚状態: {latestRecord.skin_condition ?? '未登録'}</p>
              <p>問題行動: {latestRecord.behavior_notes ?? '未登録'}</p>
              <p>注意事項: {latestRecord.caution_notes ?? '未登録'}</p>
              <Link
                href={`/medical-records?tab=list&edit=${latestRecord.id}`}
                className="text-blue-700"
              >
                カルテ詳細へ
              </Link>
            </>
          ) : (
            <>
              <p>カルテ未登録</p>
              <Link href="/medical-records?tab=list&modal=create" className="text-blue-700">
                カルテを登録
              </Link>
            </>
          )}
        </div>
      </div>
    </details>
  )
}

function AppointmentWorkflowActions({
  appointment,
  statusAction,
  isPaid,
  canQuickPay,
  linkedPaymentId,
  compact = false,
}: {
  appointment: AppointmentRow
  statusAction: { nextStatus: string; label: string } | null
  isPaid: boolean
  canQuickPay: boolean
  linkedPaymentId: string
  compact?: boolean
}) {
  const primaryButtonClass = compact
    ? 'rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700'
    : 'inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700'
  const secondaryLinkClass = compact
    ? 'text-xs text-blue-700'
    : 'inline-flex w-full items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700'
  const quietTextClass = compact
    ? 'text-xs font-semibold text-emerald-700'
    : 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700'

  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-2.5'}`}>
      {appointment.status === '予約申請' ? (
        <form action={`/api/appointments/${appointment.id}/confirm`} method="post">
          <input type="hidden" name="redirect_to" value="/dashboard" />
          <button type="submit" className={primaryButtonClass}>
            予約確認
          </button>
        </form>
      ) : null}
      {statusAction ? (
        <form action={`/api/appointments/${appointment.id}/status`} method="post">
          <input type="hidden" name="next_status" value={statusAction.nextStatus} />
          <input type="hidden" name="redirect_to" value="/dashboard" />
          <button type="submit" className={primaryButtonClass}>
            {statusAction.label}
          </button>
        </form>
      ) : null}
      {isPaid ? (
        <p className={quietTextClass}>会計済み</p>
      ) : canQuickPay ? (
        <QuickPaymentModal
          appointmentId={appointment.id}
          customerId={appointment.customer_id}
          disabled={false}
        />
      ) : null}
      {!isPaid ? (
        <Link href="/payments?tab=list&modal=create" className={secondaryLinkClass}>
          会計画面で詳細入力
        </Link>
      ) : null}
      <Link
        href={`/medical-records?tab=list&modal=create&appointment_id=${appointment.id}${linkedPaymentId ? `&payment_id=${linkedPaymentId}` : ''}`}
        className={secondaryLinkClass}
      >
        カルテ入力
      </Link>
    </div>
  )
}

function AppointmentTable({
  title,
  appointments,
  latestRecordByPetId,
  showWorkflow = false,
  paidAppointmentIds = new Set<string>(),
  paymentIdByAppointmentId = new Map<string, string>(),
}: {
  title: string
  appointments: AppointmentRow[]
  latestRecordByPetId: Map<string, MedicalRecordRow>
  showWorkflow?: boolean
  paidAppointmentIds?: Set<string>
  paymentIdByAppointmentId?: Map<string, string>
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">全 {appointments.length} 件</p>
      </div>
      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500">該当する予約はありません。</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {appointments.map((appointment) => {
              const customerName =
                getRelatedValue(appointment.customers, 'full_name') ?? '未登録'
              const petName = getRelatedValue(appointment.pets, 'name') ?? '未登録'
              const staffName = getRelatedValue(appointment.staffs, 'full_name') ?? '未登録'
              const customerId = getRelatedValue(appointment.customers, 'id') ?? appointment.customer_id
              const petId = getRelatedValue(appointment.pets, 'id') ?? appointment.pet_id
              const latestRecord = latestRecordByPetId.get(appointment.pet_id)
              const customerPhone = getRelatedValue(appointment.customers, 'phone_number') ?? '未登録'
              const customerEmail = getRelatedValue(appointment.customers, 'email') ?? '未登録'
              const petBreed = getRelatedValue(appointment.pets, 'breed') ?? '未登録'
              const petGender = getRelatedValue(appointment.pets, 'gender') ?? '未登録'
              const petNotes = getRelatedValue(appointment.pets, 'notes') ?? '未登録'
              const normalizedStatus = normalizeAppointmentStatus(appointment.status)
              const statusAction = getStatusFlowAction(appointment.status)
              const isPaid = paidAppointmentIds.has(appointment.id)
              const canQuickPay = normalizedStatus === '会計待ち' || normalizedStatus === '完了'
              const linkedPaymentId = paymentIdByAppointmentId.get(appointment.id) ?? ''

              return (
                <article key={appointment.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">{formatDateJst(appointment.start_time)}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatTimeJst(appointment.start_time)} - {formatTimeJst(appointment.end_time)}
                      </p>
                    </div>
                    {showWorkflow ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        {normalizedStatus}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">{appointment.menu}</p>
                    <p>顧客: {customerName}</p>
                    <p>ペット: {petName}</p>
                    <p>担当: {staffName}</p>
                    {appointment.notes ? <p>備考: {appointment.notes}</p> : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {showWorkflow ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          当日オペ
                        </p>
                        <AppointmentWorkflowActions
                          appointment={appointment}
                          statusAction={statusAction}
                          isPaid={isPaid}
                          canQuickPay={canQuickPay}
                          linkedPaymentId={linkedPaymentId}
                        />
                      </div>
                    ) : null}

                    <AppointmentDetailsPanel
                      customerName={customerName}
                      customerPhone={customerPhone}
                      customerEmail={customerEmail}
                      customerId={customerId}
                      petName={petName}
                      petBreed={petBreed}
                      petGender={petGender}
                      petNotes={petNotes}
                      petId={petId}
                      latestRecord={latestRecord}
                    />
                  </div>
                </article>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-2 py-2">日付</th>
                <th className="px-2 py-2">時刻</th>
                <th className="px-2 py-2">内容</th>
                <th className="px-2 py-2">顧客</th>
                <th className="px-2 py-2">ペット</th>
                <th className="px-2 py-2">担当</th>
                {showWorkflow ? <th className="px-2 py-2">ステータス</th> : null}
                <th className="px-2 py-2">詳細</th>
                {showWorkflow ? <th className="px-2 py-2">当日オペ</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((appointment) => {
                const customerName =
                  getRelatedValue(appointment.customers, 'full_name') ?? '未登録'
                const petName = getRelatedValue(appointment.pets, 'name') ?? '未登録'
                const staffName = getRelatedValue(appointment.staffs, 'full_name') ?? '未登録'
                const customerId = getRelatedValue(appointment.customers, 'id') ?? appointment.customer_id
                const petId = getRelatedValue(appointment.pets, 'id') ?? appointment.pet_id
                const latestRecord = latestRecordByPetId.get(appointment.pet_id)
                const customerPhone = getRelatedValue(appointment.customers, 'phone_number') ?? '未登録'
                const customerEmail = getRelatedValue(appointment.customers, 'email') ?? '未登録'
                const petBreed = getRelatedValue(appointment.pets, 'breed') ?? '未登録'
                const petGender = getRelatedValue(appointment.pets, 'gender') ?? '未登録'
                const petNotes = getRelatedValue(appointment.pets, 'notes') ?? '未登録'
                const normalizedStatus = normalizeAppointmentStatus(appointment.status)
                const statusAction = getStatusFlowAction(appointment.status)
                const isPaid = paidAppointmentIds.has(appointment.id)
                const canQuickPay = normalizedStatus === '会計待ち' || normalizedStatus === '完了'
                const linkedPaymentId = paymentIdByAppointmentId.get(appointment.id) ?? ''

                return (
                  <tr key={appointment.id} className="align-top text-gray-700">
                    <td className="px-2 py-3">{formatDateJst(appointment.start_time)}</td>
                    <td className="px-2 py-3">
                      {formatTimeJst(appointment.start_time)} - {formatTimeJst(appointment.end_time)}
                    </td>
                    <td className="px-2 py-3">{appointment.menu}</td>
                    <td className="px-2 py-3 font-medium text-gray-900">{customerName}</td>
                    <td className="px-2 py-3">{petName}</td>
                    <td className="px-2 py-3">{staffName}</td>
                    {showWorkflow ? (
                      <td className="px-2 py-3">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          {normalizedStatus}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-2 py-3">
                      <AppointmentDetailsPanel
                        customerName={customerName}
                        customerPhone={customerPhone}
                        customerEmail={customerEmail}
                        customerId={customerId}
                        petName={petName}
                        petBreed={petBreed}
                        petGender={petGender}
                        petNotes={petNotes}
                        petId={petId}
                        latestRecord={latestRecord}
                      />
                    </td>
                    {showWorkflow ? (
                      <td className="px-2 py-3">
                        <AppointmentWorkflowActions
                          appointment={appointment}
                          statusAction={statusAction}
                          isPaid={isPaid}
                          canQuickPay={canQuickPay}
                          linkedPaymentId={linkedPaymentId}
                          compact
                        />
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const now = new Date()
  const followupWindowDays = resolvedSearchParams?.followup_window === '30' ? 30 : 7
  const activeTab = normalizeDashboardTab(resolvedSearchParams?.tab)
  const jstNow = getJstParts(now)
  const todayStart = createDateFromJst(jstNow.year, jstNow.month, jstNow.day)
  const tomorrowStart = addDaysJst(todayStart, 1)
  const nextWeekEndExclusive = addDaysJst(todayStart, 8)
  const next30Minutes = new Date(now.getTime() + 30 * 60 * 1000)
  const todayDateKey = now.toISOString().slice(0, 10)
  const followupWindowStartDate = new Date(now.getTime() - followupWindowDays * 24 * 60 * 60 * 1000)
  const followupWindowStartIso = followupWindowStartDate.toISOString()
  const followupWindowStartDateKey = followupWindowStartDate.toISOString().slice(0, 10)
  const predictiveWindowDays = 30
  const predictiveWindowStartDate = new Date(now.getTime() - predictiveWindowDays * 24 * 60 * 60 * 1000)
  const predictiveWindowStartIso = predictiveWindowStartDate.toISOString()
  const predictiveWindowStartDateKey = predictiveWindowStartDate.toISOString().slice(0, 10)

  const supabase = await createServerSupabaseClient()
  const storeId = await resolveCurrentStoreId()
  if (!storeId) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-600">
            現在のユーザーには有効な店舗が設定されていません。`store_memberships` に所属店舗を追加してください。
          </p>
        </div>
        <Card>
          <p className="text-sm text-gray-700">
            下のボタンから初回店舗を作成するか、`README.md` の手順どおりに Supabase 側で所属店舗を作成してください。
          </p>
          <div className="mt-3">
            <Link
              href="/dashboard/setup-store"
              className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Webで店舗を作成
            </Link>
          </div>
        </Card>
      </section>
    )
  }

  const selectFields =
    'id, customer_id, pet_id, staff_id, start_time, end_time, menu, status, notes, checked_in_at, in_service_at, payment_waiting_at, completed_at, customers(id, full_name, phone_number, email), pets(id, name, breed, gender, notes), staffs(id, full_name)'

  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select(selectFields)
    .eq('store_id', storeId)
    .neq('status', 'キャンセル')
    .gte('start_time', todayStart.toISOString())
    .lt('start_time', tomorrowStart.toISOString())
    .order('start_time', { ascending: true })

  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select(selectFields)
    .eq('store_id', storeId)
    .neq('status', 'キャンセル')
    .gte('start_time', tomorrowStart.toISOString())
    .lt('start_time', nextWeekEndExclusive.toISOString())
    .order('start_time', { ascending: true })

  const allAppointments = [...(todayAppointments ?? []), ...(upcomingAppointments ?? [])] as AppointmentRow[]
  const petIds = Array.from(new Set(allAppointments.map((appointment) => appointment.pet_id))).filter(Boolean)
  const todayAppointmentIds = ((todayAppointments ?? []) as AppointmentRow[]).map((item) => item.id)

  const [
    { data: appointmentDailySummary },
    { data: paymentDailySummary },
    { data: visitDailySummary },
    { data: followupDailySummaryRows },
    { data: reofferDailySummaryRows },
  ] =
    await Promise.all([
      supabase
        .from('appointment_daily_summary_v')
        .select(
          'date_key, appointment_count, completed_count, active_appointment_count, requested_count, expected_sales'
        )
        .eq('store_id', storeId)
        .eq('date_key', todayDateKey)
        .maybeSingle(),
      supabase
        .from('payment_daily_summary_v')
        .select('date_key, payment_count, paid_count, confirmed_sales')
        .eq('store_id', storeId)
        .eq('date_key', todayDateKey)
        .maybeSingle(),
      supabase
        .from('visit_daily_summary_v')
        .select('date_key, visit_count')
        .eq('store_id', storeId)
        .eq('date_key', todayDateKey)
        .maybeSingle(),
      supabase
        .from('followup_daily_summary_v')
        .select(
          'date_key, task_count, open_count, in_progress_count, snoozed_count, resolved_booked_count, resolved_no_need_count, resolved_lost_count, due_today_count, touched_count, renotified_count'
        )
        .eq('store_id', storeId)
        .gte('date_key', followupWindowStartDateKey)
        .lte('date_key', todayDateKey),
      supabase
        .from('reoffer_daily_summary_v')
        .select(
          'date_key, total_count, accepted_count, booked_count, phone_contact_count, connected_call_count'
        )
        .eq('store_id', storeId)
        .gte('date_key', followupWindowStartDateKey)
        .lte('date_key', todayDateKey),
    ])

  const { data: medicalRecords } =
    petIds.length > 0
      ? await supabase
          .from('medical_records')
          .select('id, pet_id, record_date, menu, skin_condition, behavior_notes, caution_notes')
          .eq('store_id', storeId)
          .in('pet_id', petIds)
          .order('record_date', { ascending: false })
      : { data: [] }

  const { data: todayVisits } = await supabase
    .from('visits')
    .select('id')
    .eq('store_id', storeId)
    .gte('visit_date', todayStart.toISOString())
    .lt('visit_date', tomorrowStart.toISOString())

  const { data: allVisits } = await supabase
    .from('visits')
    .select('customer_id, visit_date')
    .eq('store_id', storeId)
    .order('visit_date', { ascending: false })

  const { data: customerRows } = await supabase
    .from('customers')
    .select('id, full_name, phone_number, line_id')
    .eq('store_id', storeId)

  const { data: predictiveCustomerFeatures } = await supabase
    .from('predictive_customer_daily_features')
    .select(
      'customer_id, metric_date_jst, appointments_count, completed_count, canceled_count, no_show_count, latest_start_time'
    )
    .eq('store_id', storeId)
    .gte('metric_date_jst', predictiveWindowStartDateKey)
    .lte('metric_date_jst', todayDateKey)

  const { data: predictiveStoreFeatures } = await supabase
    .from('predictive_store_daily_features')
    .select('metric_date_jst, appointments_count, no_show_count')
    .eq('store_id', storeId)
    .gte('metric_date_jst', followupWindowStartDateKey)
    .lte('metric_date_jst', todayDateKey)

  const { data: delayFeatureRows } = await supabase
    .from('appointments')
    .select('start_time, checked_in_at, status')
    .eq('store_id', storeId)
    .gte('start_time', predictiveWindowStartIso)
    .lt('start_time', tomorrowStart.toISOString())
    .neq('status', 'キャンセル')
    .neq('status', '無断キャンセル')

  const { data: storeSettings } = await supabase
    .from('stores')
    .select(
      'public_reserve_conflict_warn_threshold_percent, public_reserve_staff_bias_warn_threshold_percent'
    )
    .eq('id', storeId)
    .maybeSingle()

  const { data: followupTasks } = await supabase
    .from('customer_followup_tasks')
    .select(
      'id, status, resolved_at, due_on, recommended_at, resolution_type, assigned_user_id, customers(full_name, phone_number, line_id)'
    )
    .eq('store_id', storeId)

  const { data: followupStaffs } = await supabase
    .from('staffs')
    .select('id, user_id, full_name')
    .eq('store_id', storeId)

  const { data: reofferRows } = await supabase
    .from('slot_reoffers')
    .select('id, status, sent_at, accepted_at, target_staff_id')
    .eq('store_id', storeId)

  const { data: reofferLogs } = await supabase
    .from('slot_reoffer_logs')
    .select('slot_reoffer_id, event_type, payload, created_at')
    .eq('store_id', storeId)

  const { data: serviceMenusForInstant } = await supabase
    .from('service_menus')
    .select('id, name, is_active, is_instant_bookable')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  const { data: todayPayments } = await supabase
    .from('payments')
    .select('id, appointment_id, total_amount, paid_at')
    .eq('store_id', storeId)
    .gte('paid_at', todayStart.toISOString())
    .lt('paid_at', tomorrowStart.toISOString())

  const { data: todayAppointmentPayments } =
    todayAppointmentIds.length > 0
      ? await supabase
          .from('payments')
          .select('id, appointment_id, total_amount, paid_at')
          .eq('store_id', storeId)
          .in('appointment_id', todayAppointmentIds)
      : { data: [] }

  const { data: todayAppointmentMenus } =
    todayAppointmentIds.length > 0
      ? await supabase
          .from('appointment_menus')
          .select('appointment_id, price, tax_rate, tax_included')
          .eq('store_id', storeId)
          .in('appointment_id', todayAppointmentIds)
      : { data: [] }

  const [
    { count: publicReservationSubmittedTodayCount },
    { count: publicReservationInstantConfirmedTodayCount },
    { count: publicReservationConflictRejectedTodayCount },
    { data: publicReservationInstantConfirmedRows },
    { count: publicReservationSubmittedWindowCount },
    { count: publicReservationInstantConfirmedWindowCount },
    { count: publicReservationConflictRejectedWindowCount },
    { data: publicReservationInstantConfirmedWindowRows },
  ] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .contains('payload', { flow: 'instant_confirmed' })
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_conflict_rejected')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('payload')
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .contains('payload', { flow: 'instant_confirmed' })
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .gte('created_at', followupWindowStartIso)
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .contains('payload', { flow: 'instant_confirmed' })
      .gte('created_at', followupWindowStartIso)
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_conflict_rejected')
      .gte('created_at', followupWindowStartIso)
      .lt('created_at', tomorrowStart.toISOString()),
    supabase
      .from('audit_logs')
      .select('payload')
      .eq('store_id', storeId)
      .eq('action', 'public_reservation_submitted')
      .contains('payload', { flow: 'instant_confirmed' })
      .gte('created_at', followupWindowStartIso)
      .lt('created_at', tomorrowStart.toISOString()),
  ])
  const publicSubmittedToday = publicReservationSubmittedTodayCount ?? 0
  const publicInstantConfirmedToday = publicReservationInstantConfirmedTodayCount ?? 0
  const publicConflictRejectedToday = publicReservationConflictRejectedTodayCount ?? 0
  const publicInstantConfirmRateToday =
    publicSubmittedToday > 0 ? Math.round((publicInstantConfirmedToday / publicSubmittedToday) * 100) : 0
  const publicSubmittedWindow = publicReservationSubmittedWindowCount ?? 0
  const publicInstantConfirmedWindow = publicReservationInstantConfirmedWindowCount ?? 0
  const publicConflictRejectedWindow = publicReservationConflictRejectedWindowCount ?? 0
  const latestRecordByPetId = new Map<string, MedicalRecordRow>()
  ;((medicalRecords ?? []) as MedicalRecordRow[]).forEach((record) => {
    if (!latestRecordByPetId.has(record.pet_id)) {
      latestRecordByPetId.set(record.pet_id, record)
    }
  })

  const todayPaymentsList = (todayPayments ?? []) as PaymentRow[]
  const paidTodayAppointmentIds = new Set(
    ((todayAppointmentPayments ?? []) as PaymentRow[])
      .filter((payment) => Boolean(payment.paid_at))
      .map((payment) => payment.appointment_id)
  )
  const paidPaymentIdByAppointmentId = new Map<string, string>()
  ;((todayAppointmentPayments ?? []) as PaymentRow[])
    .filter((payment) => Boolean(payment.paid_at))
    .forEach((payment) => {
      if (!paidPaymentIdByAppointmentId.has(payment.appointment_id)) {
        paidPaymentIdByAppointmentId.set(payment.appointment_id, payment.id)
      }
    })
  const unpaidTodayAppointments = ((todayAppointments ?? []) as AppointmentRow[]).filter(
    (appointment) => !paidTodayAppointmentIds.has(appointment.id)
  )

  const within30MinAppointments = allAppointments.filter((appointment) => {
    const start = new Date(appointment.start_time)
    return start >= now && start <= next30Minutes
  })

  const lastVisitByCustomerId = new Map<string, string>()
  ;((allVisits ?? []) as { customer_id: string | null; visit_date: string }[]).forEach((row) => {
    if (!row.customer_id || lastVisitByCustomerId.has(row.customer_id)) return
    lastVisitByCustomerId.set(row.customer_id, row.visit_date)
  })
  const nowMs = now.getTime()
  const revisitAlerts = ((customerRows ?? []) as Array<{
    id: string
    full_name: string
    phone_number: string | null
    line_id: string | null
  }>)
    .map((customer) => {
      const lastVisit = lastVisitByCustomerId.get(customer.id)
      if (!lastVisit) return null
      const recommended = addDays(lastVisit, REVISIT_CYCLE_DAYS)
      if (!recommended) return null
      if (recommended.getTime() > nowMs) return null
      return {
        customerId: customer.id,
        customerName: customer.full_name,
        phoneNumber: customer.phone_number,
        lineId: customer.line_id,
        overdueDays: Math.max(0, Math.floor((nowMs - recommended.getTime()) / (24 * 60 * 60 * 1000))),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.overdueDays - a.overdueDays)

  const customerNameById = new Map(
    ((customerRows ?? []) as Array<{ id: string; full_name: string; phone_number: string | null; line_id: string | null }>).map(
      (row) => [row.id, row.full_name]
    )
  )
  const predictiveCustomerRows = (predictiveCustomerFeatures ?? []) as PredictiveCustomerDailyFeatureRow[]
  const predictiveByCustomerId = new Map<
    string,
    {
      appointmentsCount: number
      completedCount: number
      canceledCount: number
      noShowCount: number
      latestStartTime: string | null
    }
  >()
  predictiveCustomerRows.forEach((row) => {
    if (!row.customer_id) return
    const current = predictiveByCustomerId.get(row.customer_id) ?? {
      appointmentsCount: 0,
      completedCount: 0,
      canceledCount: 0,
      noShowCount: 0,
      latestStartTime: null,
    }
    current.appointmentsCount += row.appointments_count ?? 0
    current.completedCount += row.completed_count ?? 0
    current.canceledCount += row.canceled_count ?? 0
    current.noShowCount += row.no_show_count ?? 0
    if (!current.latestStartTime || (row.latest_start_time && row.latest_start_time > current.latestStartTime)) {
      current.latestStartTime = row.latest_start_time
    }
    predictiveByCustomerId.set(row.customer_id, current)
  })
  const churnRiskRows = Array.from(predictiveByCustomerId.entries())
    .map(([customerId, row]) => {
      const latestStartMs = row.latestStartTime ? new Date(row.latestStartTime).getTime() : NaN
      const daysSinceLastVisit = Number.isFinite(latestStartMs)
        ? Math.max(0, Math.floor((now.getTime() - latestStartMs) / (24 * 60 * 60 * 1000)))
        : 999
      const riskLevel =
        row.noShowCount >= 1 && row.canceledCount >= 2
          ? '高'
          : row.canceledCount >= 2 || daysSinceLastVisit >= REVISIT_CYCLE_DAYS
            ? '中'
            : '低'
      return {
        customerId,
        customerName: customerNameById.get(customerId) ?? '未登録',
        riskLevel,
        noShowCount: row.noShowCount,
        canceledCount: row.canceledCount,
        appointmentsCount: row.appointmentsCount,
        daysSinceLastVisit,
      }
    })
    .filter((row) => row.riskLevel !== '低')
    .sort((a, b) => {
      if (a.riskLevel !== b.riskLevel) return a.riskLevel === '高' ? -1 : 1
      if (b.noShowCount !== a.noShowCount) return b.noShowCount - a.noShowCount
      if (b.canceledCount !== a.canceledCount) return b.canceledCount - a.canceledCount
      return b.daysSinceLastVisit - a.daysSinceLastVisit
    })
  const highRiskChurnCount = churnRiskRows.filter((row) => row.riskLevel === '高').length
  const mediumRiskChurnCount = churnRiskRows.filter((row) => row.riskLevel === '中').length
  const predictiveStoreRows = (predictiveStoreFeatures ?? []) as PredictiveStoreDailyFeatureRow[]
  const latestStorePredictive = predictiveStoreRows
    .slice()
    .sort((a, b) => (a.metric_date_jst < b.metric_date_jst ? 1 : -1))[0]
  const noShowRateTodayFromPredictive =
    latestStorePredictive && latestStorePredictive.appointments_count > 0
      ? Math.round((latestStorePredictive.no_show_count / latestStorePredictive.appointments_count) * 100)
      : 0

  const delayRows = (delayFeatureRows ?? []) as DelayFeatureRow[]
  const delayByHour = new Map<number, { total: number; delayed: number }>()
  delayRows.forEach((row) => {
    if (!row.checked_in_at) return
    const start = new Date(row.start_time).getTime()
    const checkedIn = new Date(row.checked_in_at).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(checkedIn)) return
    const delayMin = Math.round((checkedIn - start) / (60 * 1000))
    const hour = getJstParts(new Date(row.start_time)).hour
    const current = delayByHour.get(hour) ?? { total: 0, delayed: 0 }
    current.total += 1
    if (delayMin >= 15) current.delayed += 1
    delayByHour.set(hour, current)
  })
  const delayHotspotRows = Array.from(delayByHour.entries())
    .map(([hour, row]) => ({
      hour,
      total: row.total,
      delayed: row.delayed,
      delayRate: row.total > 0 ? Math.round((row.delayed / row.total) * 100) : 0,
    }))
    .filter((row) => row.total >= 3 && row.delayRate >= 30)
    .sort((a, b) => {
      if (b.delayRate !== a.delayRate) return b.delayRate - a.delayRate
      return b.total - a.total
    })
    .slice(0, 3)

  const followupTaskRows = ((followupTasks ?? []) as FollowupDashboardRow[])
  const followupStaffRows = ((followupStaffs ?? []) as Array<{
    id: string
    user_id: string | null
    full_name: string
  }>)
  const followupStaffNameByUserId = new Map(
    followupStaffRows.filter((staff) => Boolean(staff.user_id)).map((staff) => [staff.user_id as string, staff.full_name])
  )
  followupTaskRows.forEach((task) => {
    task.assignee_name = task.assigned_user_id
      ? followupStaffNameByUserId.get(task.assigned_user_id) ?? null
      : null
  })
  const followupWindowStartMs = now.getTime() - followupWindowDays * 24 * 60 * 60 * 1000
  const followupDailySummaries = (followupDailySummaryRows ?? []) as FollowupDailySummaryRow[]
  const reofferDailySummaries = (reofferDailySummaryRows ?? []) as ReofferDailySummaryRow[]
  const followupOpenCountFromView = followupDailySummaries.reduce((sum, row) => sum + (row.open_count ?? 0), 0)
  const followupInProgressCountFromView = followupDailySummaries.reduce(
    (sum, row) => sum + (row.in_progress_count ?? 0),
    0
  )
  const followupSnoozedCountFromView = followupDailySummaries.reduce(
    (sum, row) => sum + (row.snoozed_count ?? 0),
    0
  )
  const followupBookedCountFromView = followupDailySummaries.reduce(
    (sum, row) => sum + (row.resolved_booked_count ?? 0),
    0
  )
  const followupDueTodayCountFromView = followupDailySummaries.reduce(
    (sum, row) => sum + (row.due_today_count ?? 0),
    0
  )
  const followupOpenCount = followupOpenCountFromView || followupTaskRows.filter((task) => task.status === 'open').length
  const followupInProgressCount =
    followupInProgressCountFromView || followupTaskRows.filter((task) => task.status === 'in_progress').length
  const followupSnoozedCount =
    followupSnoozedCountFromView || followupTaskRows.filter((task) => task.status === 'snoozed').length
  const followupBookedCount = followupTaskRows.filter((task) => {
    if (task.status !== 'resolved_booked' || !task.resolved_at) return false
    const resolvedMs = new Date(task.resolved_at).getTime()
    return Number.isFinite(resolvedMs) && resolvedMs >= followupWindowStartMs
  }).length
  const followupDueTodayCount =
    followupDueTodayCountFromView || followupTaskRows.filter((task) => task.due_on === todayDateKey).length
  const followupResolvedThisWeek = followupTaskRows.filter((task) => {
    if (!task.resolved_at) return false
    const resolvedMs = new Date(task.resolved_at).getTime()
    return Number.isFinite(resolvedMs) && resolvedMs >= followupWindowStartMs
  }).length
  const followupBookedRate =
    followupResolvedThisWeek > 0
      ? Math.round((((followupBookedCountFromView || followupBookedCount) / followupResolvedThisWeek) * 100))
      : 0
  const followupPriorityRows = followupTaskRows
    .filter((task) => task.status === 'open' || task.status === 'in_progress' || task.status === 'snoozed')
    .sort((a, b) => {
      const aDate = a.due_on ?? a.recommended_at.slice(0, 10)
      const bDate = b.due_on ?? b.recommended_at.slice(0, 10)
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0
    })
    .slice(0, 5)
  const followupStaffStatsMap = new Map<
    string,
    {
      name: string
      total: number
      active: number
      booked: number
    }
  >()
  followupTaskRows.forEach((task) => {
    const assigneeKey = task.assigned_user_id ?? 'unassigned'
    const assigneeName =
      task.assignee_name ?? (task.assigned_user_id ? '不明ユーザー' : '未割当')
    const current = followupStaffStatsMap.get(assigneeKey) ?? {
      name: assigneeName,
      total: 0,
      active: 0,
      booked: 0,
    }
    current.total += 1
    if (task.status === 'open' || task.status === 'in_progress' || task.status === 'snoozed') {
      current.active += 1
    }
    if (task.status === 'resolved_booked') {
      current.booked += 1
    }
    followupStaffStatsMap.set(assigneeKey, current)
  })
  const followupStaffStats = Array.from(followupStaffStatsMap.values())
    .map((row) => ({
      ...row,
      bookedRate: row.total > 0 ? Math.round((row.booked / row.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.active !== a.active) return b.active - a.active
      return b.total - a.total
    })
  const reofferDashboardRows = ((reofferRows ?? []) as ReofferDashboardRow[])
  const reofferLogRows = ((reofferLogs ?? []) as ReofferLogDashboardRow[])
  const reofferWindowRows = reofferDashboardRows.filter((row) => {
    const baseValue = row.accepted_at ?? row.sent_at
    if (!baseValue) return false
    const baseMs = new Date(baseValue).getTime()
    return Number.isFinite(baseMs) && baseMs >= followupWindowStartMs
  })
  const reofferAcceptedCountFromView = reofferDailySummaries.reduce(
    (sum, row) => sum + (row.accepted_count ?? 0),
    0
  )
  const reofferAppointmentCreatedCountFromView = reofferDailySummaries.reduce(
    (sum, row) => sum + (row.booked_count ?? 0),
    0
  )
  const reofferAcceptedCount = reofferAcceptedCountFromView || reofferDashboardRows.filter((row) => {
    if (!row.accepted_at) return false
    const acceptedMs = new Date(row.accepted_at).getTime()
    return Number.isFinite(acceptedMs) && acceptedMs >= followupWindowStartMs
  }).length
  const reofferAppointmentCreatedCount =
    reofferAppointmentCreatedCountFromView || reofferLogRows.filter((row) => {
    const createdMs = new Date(row.created_at).getTime()
    if (!Number.isFinite(createdMs) || createdMs < followupWindowStartMs) return false
    return row.event_type === 'appointment_created'
  }).length
  const reofferBookedRate =
    reofferAcceptedCount > 0 ? Math.round((reofferAppointmentCreatedCount / reofferAcceptedCount) * 100) : 0
  const staffNameByStaffId = new Map(followupStaffRows.map((staff) => [staff.id, staff.full_name]))
  const instantConfirmedStaffCountMap = new Map<string, number>()
  ;((publicReservationInstantConfirmedRows ?? []) as Array<{ payload: { [key: string]: Json | undefined } | null }>).forEach(
    (row) => {
      const staffId = typeof row.payload?.staff_id === 'string' ? row.payload.staff_id : null
      if (!staffId) return
      instantConfirmedStaffCountMap.set(staffId, (instantConfirmedStaffCountMap.get(staffId) ?? 0) + 1)
    }
  )
  let publicReservationTopStaffName = '-'
  let publicReservationTopStaffCount = 0
  instantConfirmedStaffCountMap.forEach((count, staffId) => {
    if (count <= publicReservationTopStaffCount) return
    publicReservationTopStaffCount = count
    publicReservationTopStaffName = staffNameByStaffId.get(staffId) ?? '不明スタッフ'
  })
  const publicReservationStaffBiasRateToday =
    publicInstantConfirmedToday > 0
      ? Math.round((publicReservationTopStaffCount / publicInstantConfirmedToday) * 100)
      : 0
  const instantConfirmedStaffCountWindowMap = new Map<string, number>()
  ;((publicReservationInstantConfirmedWindowRows ?? []) as Array<{ payload: { [key: string]: Json | undefined } | null }>).forEach(
    (row) => {
      const staffId = typeof row.payload?.staff_id === 'string' ? row.payload.staff_id : null
      if (!staffId) return
      instantConfirmedStaffCountWindowMap.set(
        staffId,
        (instantConfirmedStaffCountWindowMap.get(staffId) ?? 0) + 1
      )
    }
  )
  let publicReservationTopStaffWindowCount = 0
  instantConfirmedStaffCountWindowMap.forEach((count) => {
    if (count <= publicReservationTopStaffWindowCount) return
    publicReservationTopStaffWindowCount = count
  })
  const publicReservationStaffBiasRateWindow =
    publicInstantConfirmedWindow > 0
      ? Math.round((publicReservationTopStaffWindowCount / publicInstantConfirmedWindow) * 100)
      : 0
  const publicConflictFailureRateToday =
    publicSubmittedToday > 0 ? Math.round((publicConflictRejectedToday / publicSubmittedToday) * 100) : 0
  const publicConflictFailureRateWindow =
    publicSubmittedWindow > 0
      ? Math.round((publicConflictRejectedWindow / publicSubmittedWindow) * 100)
      : 0
  const PUBLIC_CONFLICT_WARN_THRESHOLD =
    Number(storeSettings?.public_reserve_conflict_warn_threshold_percent ?? 10) || 10
  const PUBLIC_STAFF_BIAS_WARN_THRESHOLD =
    Number(storeSettings?.public_reserve_staff_bias_warn_threshold_percent ?? 70) || 70
  const instantBookableMenus = ((serviceMenusForInstant as ServiceMenuInstantRow[] | null) ?? []).filter(
    (menu) => Boolean(menu.is_instant_bookable)
  )
  const hasInstantBookableMenu = instantBookableMenus.length > 0
  const publicReserveLimitedModeReady = hasInstantBookableMenu
  const publicReserveLimitedModeOperating =
    publicReserveLimitedModeReady && publicInstantConfirmedWindow > 0
  const showPublicKpiAlertToday =
    publicConflictFailureRateToday >= PUBLIC_CONFLICT_WARN_THRESHOLD ||
    publicReservationStaffBiasRateToday >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
  const showPublicKpiAlertWindow =
    publicConflictFailureRateWindow >= PUBLIC_CONFLICT_WARN_THRESHOLD ||
    publicReservationStaffBiasRateWindow >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
  const reofferCreatedById = new Set(
    reofferLogRows
      .filter((row) => row.event_type === 'appointment_created')
      .map((row) => row.slot_reoffer_id)
      .filter((value): value is string => Boolean(value))
  )
  const reofferStaffStatsMap = new Map<
    string,
    {
      name: string
      total: number
      accepted: number
      booked: number
    }
  >()
  reofferWindowRows.forEach((row) => {
    const key = row.target_staff_id ?? 'unassigned'
    const name = row.target_staff_id ? staffNameByStaffId.get(row.target_staff_id) ?? '不明スタッフ' : '未指定'
    const current = reofferStaffStatsMap.get(key) ?? {
      name,
      total: 0,
      accepted: 0,
      booked: 0,
    }
    current.total += 1
    if (row.status === 'accepted') current.accepted += 1
    if (reofferCreatedById.has(row.id)) current.booked += 1
    reofferStaffStatsMap.set(key, current)
  })
  const reofferStaffStats = Array.from(reofferStaffStatsMap.values())
    .map((row) => ({
      ...row,
      bookedRate: row.accepted > 0 ? Math.round((row.booked / row.accepted) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.accepted !== a.accepted) return b.accepted - a.accepted
      return b.total - a.total
    })
  const urgentActionCount =
    within30MinAppointments.length + unpaidTodayAppointments.length + followupDueTodayCount
  const todayAppointmentCount =
    (appointmentDailySummary as AppointmentDailySummaryRow | null)?.appointment_count ??
    ((todayAppointments ?? []) as AppointmentRow[]).length
  const todayVisitCount =
    (visitDailySummary as VisitDailySummaryRow | null)?.visit_count ?? (todayVisits ?? []).length
  const expectedTodaySales =
    Number((appointmentDailySummary as AppointmentDailySummaryRow | null)?.expected_sales ?? 0) ||
    calculateMenuTotals((todayAppointmentMenus ?? []) as AppointmentMenuRow[]).total
  const confirmedTodaySales =
    Number((paymentDailySummary as PaymentDailySummaryRow | null)?.confirmed_sales ?? 0) ||
    todayPaymentsList.reduce((sum, payment) => sum + (payment.total_amount ?? 0), 0)
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">ダッシュボード</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded border bg-white p-1 text-sm">
            <Link
              href={buildDashboardHref(activeTab, 7)}
              className={`rounded px-3 py-1.5 font-semibold ${
                followupWindowDays === 7 ? 'bg-sky-600 text-white' : 'text-gray-600'
              }`}
            >
              直近7日
            </Link>
            <Link
              href={buildDashboardHref(activeTab, 30)}
              className={`rounded px-3 py-1.5 font-semibold ${
                followupWindowDays === 30 ? 'bg-sky-600 text-white' : 'text-gray-600'
              }`}
            >
              直近30日
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2">
          {dashboardTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={buildDashboardHref(tab.id, followupWindowDays)}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">本日の予約件数</p><p className="text-2xl font-semibold text-gray-900">{todayAppointmentCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日の来店済み件数</p><p className="text-2xl font-semibold text-gray-900">{todayVisitCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日売上見込み</p><p className="text-2xl font-semibold text-gray-900">{formatYen(expectedTodaySales)}</p></Card>
            <Card><p className="text-xs text-gray-500">本日確定売上</p><p className="text-2xl font-semibold text-gray-900">{formatYen(confirmedTodaySales)}</p></Card>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Card className="border border-slate-200 bg-slate-900 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Today Focus</p>
                  <h2 className="text-2xl font-semibold">優先対応 {urgentActionCount} 件</h2>
                </div>
                <Link href={buildDashboardHref('operations', followupWindowDays)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white">当日運用を開く</Link>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-300">30分以内の予約</p><p className="mt-2 text-2xl font-semibold">{within30MinAppointments.length} 件</p></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-300">未会計</p><p className="mt-2 text-2xl font-semibold">{unpaidTodayAppointments.length} 件</p></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-300">フォロー今日期限</p><p className="mt-2 text-2xl font-semibold">{followupDueTodayCount} 件</p></div>
              </div>
            </Card>
            <Card>
              <div className="mb-4"><h2 className="text-lg font-semibold text-gray-900">次の一手</h2></div>
              <div className="space-y-3">
                <Link href={buildDashboardHref('followups', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3"><div><p className="text-sm font-semibold text-sky-900">再来店フォロー</p><p className="text-xs text-sky-700">高リスク {highRiskChurnCount} 件 / 未着手 {followupOpenCount} 件</p></div><span className="text-sm font-semibold text-sky-800">開く</span></Link>
                <Link href={buildDashboardHref('reoffers', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div><p className="text-sm font-semibold text-emerald-900">空き枠再販</p><p className="text-xs text-emerald-700">受付 {reofferAcceptedCount} 件 / 予約化 {reofferAppointmentCreatedCount} 件</p></div><span className="text-sm font-semibold text-emerald-800">開く</span></Link>
                <Link href={buildDashboardHref('operations', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><div><p className="text-sm font-semibold text-amber-900">当日運用</p><p className="text-xs text-amber-700">近接予約 {within30MinAppointments.length} 件 / 遅延注意時間帯 {delayHotspotRows.length} 件</p></div><span className="text-sm font-semibold text-amber-800">開く</span></Link>
                <Link href="/inventory/reorder-suggestions" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"><div><p className="text-sm font-semibold text-rose-900">欠品予兆</p><p className="text-xs text-rose-700">発注提案と優先順位を確認</p></div><span className="text-sm font-semibold text-rose-800">開く</span></Link>
                <Link href="/service-menus?tab=list" className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3"><div><p className="text-sm font-semibold text-violet-900">所要時間補正</p><p className="text-xs text-violet-700">メニュー推奨時間を確認</p></div><span className="text-sm font-semibold text-violet-800">開く</span></Link>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === 'operations' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">30分以内の予約</p><p className="text-2xl font-semibold text-gray-900">{within30MinAppointments.length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">未会計アラート</p><p className="text-2xl font-semibold text-gray-900">{unpaidTodayAppointments.length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日の予約件数</p><p className="text-2xl font-semibold text-gray-900">{todayAppointmentCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日確定売上</p><p className="text-2xl font-semibold text-gray-900">{formatYen(confirmedTodaySales)}</p></Card>
          </div>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">遅延しやすい時間帯（直近30日）</h2>
              </div>
              <Link href="/ops/today" className="text-sm font-semibold text-blue-700">
                モバイル当日運用へ
              </Link>
            </div>
            {delayHotspotRows.length === 0 ? (
              <p className="text-sm text-gray-500">遅延注意の時間帯は検出されませんでした。</p>
            ) : (
              <div className="space-y-2">
                {delayHotspotRows.map((row) => (
                  <div key={row.hour} className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-semibold text-gray-900">{String(row.hour).padStart(2, '0')}:00 台</p>
                    <p className="text-gray-700">
                      遅延率 {row.delayRate}%（{row.delayed}/{row.total} 件）
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">30分以内の予約</h2><p className="text-sm text-gray-500">全 {within30MinAppointments.length} 件</p></div>
            {within30MinAppointments.length === 0 ? <p className="text-sm text-gray-500">30分以内に開始する予約はありません。</p> : <div className="space-y-2">{within30MinAppointments.map((appointment) => (<div key={appointment.id} className="rounded border p-3 text-sm"><p className="font-semibold text-gray-900">{formatTimeJst(appointment.start_time)} - {formatTimeJst(appointment.end_time)} / {getRelatedValue(appointment.pets, 'name') ?? '未登録'}</p><p className="text-gray-600">顧客: {getRelatedValue(appointment.customers, 'full_name') ?? '未登録'} / 担当: {getRelatedValue(appointment.staffs, 'full_name') ?? '未登録'}</p><p className="text-gray-600">{appointment.menu}</p></div>))}</div>}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">未会計アラート（本日）</h2><p className="text-sm text-gray-500">全 {unpaidTodayAppointments.length} 件</p></div>
            {unpaidTodayAppointments.length === 0 ? <p className="text-sm text-gray-500">本日の未会計予約はありません。</p> : <div className="space-y-2">{unpaidTodayAppointments.map((appointment) => (<div key={appointment.id} className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-gray-900">{formatTimeJst(appointment.start_time)} / {getRelatedValue(appointment.pets, 'name') ?? '未登録'}</p><p className="text-gray-700">顧客: {getRelatedValue(appointment.customers, 'full_name') ?? '未登録'} / 担当: {getRelatedValue(appointment.staffs, 'full_name') ?? '未登録'}</p></div><Link href="/payments?tab=list&modal=create" className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">会計へ</Link></div>))}</div>}
          </Card>
          <AppointmentTable title="当日の予約一覧" appointments={(todayAppointments as AppointmentRow[]) ?? []} latestRecordByPetId={latestRecordByPetId} showWorkflow paidAppointmentIds={paidTodayAppointmentIds} paymentIdByAppointmentId={paidPaymentIdByAppointmentId} />
          <AppointmentTable title="今後1週間の予約一覧" appointments={(upcomingAppointments as AppointmentRow[]) ?? []} latestRecordByPetId={latestRecordByPetId} />
        </>
      ) : null}

      {activeTab === 'followups' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">再来店フォロー未着手</p><p className="text-2xl font-semibold text-gray-900">{followupOpenCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">再来店フォロー対応中</p><p className="text-2xl font-semibold text-gray-900">{followupInProgressCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">再来店フォロー保留</p><p className="text-2xl font-semibold text-gray-900">{followupSnoozedCount} 件</p><p className="text-xs text-gray-500">今日期限: {followupDueTodayCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">期間内の予約化</p><p className="text-2xl font-semibold text-gray-900">{followupBookedCount} 件</p><p className="text-xs text-gray-500">予約化率: {followupBookedRate}%</p></Card>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className={noShowRateTodayFromPredictive >= 10 ? 'border border-amber-300 bg-amber-50' : ''}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">無断キャンセル予兆（店舗）</p>
                  <p className="text-2xl font-semibold text-gray-900">{noShowRateTodayFromPredictive}%</p>
                </div>
                <Link href={buildDashboardHref('operations', followupWindowDays)} className="text-sm font-semibold text-blue-700">
                  当日運用を確認
                </Link>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                最新日: {latestStorePredictive?.metric_date_jst ?? '-'} / 閾値 10%
              </p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500">離脱予兆（顧客）</p>
              <p className="text-2xl font-semibold text-gray-900">
                高 {highRiskChurnCount} 件 / 中 {mediumRiskChurnCount} 件
              </p>
              <p className="mt-2 text-xs text-gray-600">直近{predictiveWindowDays}日ベース（キャンセル傾向 + 来店間隔）</p>
            </Card>
          </div>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">離脱予兆の優先対応リスト</h2>
              <Link href="/customers?tab=alerts" className="text-sm font-semibold text-blue-700">
                顧客一覧へ
              </Link>
            </div>
            {churnRiskRows.length === 0 ? (
              <p className="text-sm text-gray-500">高/中リスクの顧客はありません。</p>
            ) : (
              <div className="space-y-2">
                {churnRiskRows.slice(0, 8).map((row) => (
                  <div key={row.customerId} className="flex flex-col gap-2 rounded border border-sky-200 bg-sky-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {row.customerName}
                        <span className={`ml-2 rounded px-2 py-0.5 text-xs ${row.riskLevel === '高' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.riskLevel}リスク
                        </span>
                      </p>
                      <p className="text-gray-700">
                        無断キャンセル {row.noShowCount} / キャンセル {row.canceledCount} / 最終来店 {row.daysSinceLastVisit} 日前
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/customers?tab=list&edit=${row.customerId}`} className="rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        顧客編集
                      </Link>
                      <Link href={`/appointments?tab=list&modal=create&followup_customer_id=${row.customerId}`} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
                        予約作成
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">再来店フォロー隊列</h2><Link href="/customers?tab=alerts" className="text-sm font-semibold text-blue-700">一覧へ</Link></div>
            {followupPriorityRows.length === 0 ? <p className="text-sm text-gray-500">対応中のフォローアップはありません。</p> : <div className="space-y-2">{followupPriorityRows.map((task) => (<div key={task.id} className="flex flex-col gap-1 rounded border border-sky-200 bg-sky-50 p-3 text-sm md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-gray-900">{getRelatedValue(task.customers, 'full_name') ?? '未登録'} / {task.status}</p><p className="text-gray-700">期限: {task.due_on ?? task.recommended_at.slice(0, 10)} / 電話: {getRelatedValue(task.customers, 'phone_number') ?? '未登録'} / LINE: {getRelatedValue(task.customers, 'line_id') ?? '未登録'}</p></div></div>))}</div>}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">来店周期アラート</h2><p className="text-sm text-gray-500">全 {revisitAlerts.length} 件</p></div>
            {revisitAlerts.length === 0 ? <p className="text-sm text-gray-500">来店周期アラートはありません。</p> : <div className="space-y-2">{revisitAlerts.slice(0, 8).map((alert) => (<div key={alert.customerId} className="flex flex-col gap-1 rounded border border-amber-200 bg-amber-50 p-3 text-sm md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-gray-900">{alert.customerName}（{alert.overdueDays}日超過）</p><p className="text-gray-700">電話: {alert.phoneNumber ?? '未登録'} / LINE: {alert.lineId ?? '未登録'}</p></div></div>))}<div><Link href="/customers?tab=alerts" className="text-sm font-semibold text-blue-700">来店周期アラート一覧へ</Link></div></div>}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">担当者別フォローKPI</h2><p className="text-sm text-gray-500">直近{followupWindowDays}日基準</p></div>
            {followupStaffStats.length === 0 ? <p className="text-sm text-gray-500">担当者別データはまだありません。</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><th className="px-2 py-2">担当者</th><th className="px-2 py-2">総件数</th><th className="px-2 py-2">未完了</th><th className="px-2 py-2">予約化</th><th className="px-2 py-2">予約化率</th></tr></thead><tbody className="divide-y">{followupStaffStats.map((row) => (<tr key={row.name} className="text-gray-700"><td className="px-2 py-3 font-medium text-gray-900">{row.name}</td><td className="px-2 py-3">{row.total} 件</td><td className="px-2 py-3">{row.active} 件</td><td className="px-2 py-3">{row.booked} 件</td><td className="px-2 py-3">{row.bookedRate}%</td></tr>))}</tbody></table></div>}
          </Card>
        </>
      ) : null}

      {activeTab === 'reoffers' ? (
        <>
          <Card className={hasInstantBookableMenu ? '' : 'border border-amber-300 bg-amber-50'}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">即時確定対象メニュー</p>
              <Link href="/service-menus?tab=list" className="text-xs font-semibold text-blue-700">
                メニュー設定を開く
              </Link>
            </div>
            <p className="text-xs text-gray-600">
              現在の対象件数: {instantBookableMenus.length} 件
              {!hasInstantBookableMenu ? '（未設定）' : ''}
            </p>
            {!hasInstantBookableMenu ? (
              <p className="mt-2 text-xs text-amber-800">
                即時確定対象が0件のため、公開予約は空き枠提示を行わず希望日時申請のみになります。
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-700">
                {instantBookableMenus.slice(0, 6).map((menu) => menu.name).join(' / ')}
                {instantBookableMenus.length > 6 ? ' ...' : ''}
              </p>
            )}
          </Card>
          <Card className={publicReserveLimitedModeOperating ? 'border border-emerald-300 bg-emerald-50' : 'border border-amber-300 bg-amber-50'}>
            <p className="text-sm font-semibold text-gray-900">空き枠提示型の運用ステータス</p>
            <p className="mt-1 text-xs text-gray-700">
              {publicReserveLimitedModeOperating ? '運用中' : publicReserveLimitedModeReady ? '準備完了（実績待ち）' : '準備未完了'}
            </p>
            <p className="mt-2 text-xs text-gray-600">
              判定条件: 即時確定対象メニューが1件以上 / 直近{followupWindowDays}日の即時確定件数 {publicInstantConfirmedWindow} 件
            </p>
          </Card>
          {showPublicKpiAlertToday ? (
            <Card className="border border-amber-300 bg-amber-50">
              <p className="text-sm font-semibold text-amber-900">公開予約KPIアラート（本日）</p>
              <p className="mt-1 text-xs text-amber-800">
                {publicConflictFailureRateToday >= PUBLIC_CONFLICT_WARN_THRESHOLD
                  ? `競合失敗率が ${publicConflictFailureRateToday}%（閾値 ${PUBLIC_CONFLICT_WARN_THRESHOLD}%）です。`
                  : ''}
                {publicConflictFailureRateToday >= PUBLIC_CONFLICT_WARN_THRESHOLD &&
                publicReservationStaffBiasRateToday >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
                  ? ' '
                  : ''}
                {publicReservationStaffBiasRateToday >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
                  ? `スタッフ偏り率が ${publicReservationStaffBiasRateToday}%（閾値 ${PUBLIC_STAFF_BIAS_WARN_THRESHOLD}%）です。`
                  : ''}
              </p>
            </Card>
          ) : null}
          {showPublicKpiAlertWindow ? (
            <Card className="border border-amber-300 bg-amber-50">
              <p className="text-sm font-semibold text-amber-900">
                公開予約KPIアラート（直近{followupWindowDays}日）
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {publicConflictFailureRateWindow >= PUBLIC_CONFLICT_WARN_THRESHOLD
                  ? `競合失敗率が ${publicConflictFailureRateWindow}%（閾値 ${PUBLIC_CONFLICT_WARN_THRESHOLD}%）です。`
                  : ''}
                {publicConflictFailureRateWindow >= PUBLIC_CONFLICT_WARN_THRESHOLD &&
                publicReservationStaffBiasRateWindow >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
                  ? ' '
                  : ''}
                {publicReservationStaffBiasRateWindow >= PUBLIC_STAFF_BIAS_WARN_THRESHOLD
                  ? `スタッフ偏り率が ${publicReservationStaffBiasRateWindow}%（閾値 ${PUBLIC_STAFF_BIAS_WARN_THRESHOLD}%）です。`
                  : ''}
              </p>
            </Card>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">公開予約受付（本日）</p><p className="text-2xl font-semibold text-gray-900">{publicSubmittedToday} 件</p></Card>
            <Card><p className="text-xs text-gray-500">公開予約 即時確定（本日）</p><p className="text-2xl font-semibold text-gray-900">{publicInstantConfirmedToday} 件</p><p className="text-xs text-gray-500">即時確定率: {publicInstantConfirmRateToday}%</p></Card>
            <Card><p className="text-xs text-gray-500">競合再検証失敗（本日）</p><p className="text-2xl font-semibold text-gray-900">{publicConflictRejectedToday} 件</p></Card>
            <Card><p className="text-xs text-gray-500">競合失敗率（本日）</p><p className="text-2xl font-semibold text-gray-900">{publicConflictFailureRateToday}%</p><p className="text-xs text-gray-500">スタッフ偏り率: {publicReservationStaffBiasRateToday}%（最多 {publicReservationTopStaffName}: {publicReservationTopStaffCount}件）</p></Card>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card><p className="text-xs text-gray-500">再販受付件数</p><p className="text-2xl font-semibold text-gray-900">{reofferAcceptedCount} 件</p><p className="text-xs text-gray-500">直近{followupWindowDays}日で accepted</p></Card>
            <Card><p className="text-xs text-gray-500">再販から予約作成</p><p className="text-2xl font-semibold text-gray-900">{reofferAppointmentCreatedCount} 件</p><p className="text-xs text-gray-500">予約化率: {reofferBookedRate}%</p></Card>
          </div>
          <Card><SlotReofferPanel /></Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">担当者別 再販KPI</h2><p className="text-sm text-gray-500">直近{followupWindowDays}日基準</p></div>
            {reofferStaffStats.length === 0 ? <p className="text-sm text-gray-500">担当者別の再販データはまだありません。</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><th className="px-2 py-2">担当者</th><th className="px-2 py-2">総件数</th><th className="px-2 py-2">受付完了</th><th className="px-2 py-2">予約化</th><th className="px-2 py-2">予約化率</th></tr></thead><tbody className="divide-y">{reofferStaffStats.map((row) => (<tr key={row.name} className="text-gray-700"><td className="px-2 py-3 font-medium text-gray-900">{row.name}</td><td className="px-2 py-3">{row.total} 件</td><td className="px-2 py-3">{row.accepted} 件</td><td className="px-2 py-3">{row.booked} 件</td><td className="px-2 py-3">{row.bookedRate}%</td></tr>))}</tbody></table></div>}
          </Card>
        </>
      ) : null}
    </section>
  )
}
