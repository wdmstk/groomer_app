import Link from 'next/link'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { QuickPaymentModal } from '@/components/dashboard/QuickPaymentModal'
import { NotificationTemplateEditor } from '@/components/dashboard/NotificationTemplateEditor'
import { SlotReofferPanel } from '@/components/dashboard/SlotReofferPanel'

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
  payload: Record<string, unknown> | null
  created_at: string
}

type CustomerNotificationDashboardRow = {
  channel: string
  status: string
  payload: Record<string, unknown> | null
  sent_at: string
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
    'id, customer_id, pet_id, staff_id, start_time, end_time, menu, status, notes, customers(id, full_name, phone_number, email), pets(id, name, breed, gender, notes), staffs(id, full_name)'

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

  const { data: followupTasks } = await supabase
    .from('customer_followup_tasks')
    .select(
      'id, status, resolved_at, due_on, recommended_at, resolution_type, assigned_user_id, customers(full_name, phone_number, line_id)'
    )
    .eq('store_id', storeId)

  const { data: followupEvents } = await supabase
    .from('customer_followup_events')
    .select('task_id, event_type, created_at')
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

  const { data: reofferNotificationLogs } = await supabase
    .from('customer_notification_logs')
    .select('channel, status, payload, sent_at')
    .eq('store_id', storeId)
    .eq('notification_type', 'slot_reoffer')

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

  const expectedTodaySales = calculateMenuTotals((todayAppointmentMenus ?? []) as AppointmentMenuRow[]).total
  const confirmedTodaySales = todayPaymentsList.reduce(
    (sum, payment) => sum + (payment.total_amount ?? 0),
    0
  )

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

  const followupTaskRows = ((followupTasks ?? []) as FollowupDashboardRow[])
  const followupEventRows = ((followupEvents ?? []) as Array<{
    task_id: string
    event_type: string
    created_at: string
  }>)
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
  const todayDateKey = now.toISOString().slice(0, 10)
  const followupWindowStartMs = now.getTime() - followupWindowDays * 24 * 60 * 60 * 1000
  const followupOpenCount = followupTaskRows.filter((task) => task.status === 'open').length
  const followupInProgressCount = followupTaskRows.filter((task) => task.status === 'in_progress').length
  const followupSnoozedCount = followupTaskRows.filter((task) => task.status === 'snoozed').length
  const followupTouchedCount = followupTaskRows.filter((task) => task.status !== 'open').length
  const followupBookedCount = followupTaskRows.filter((task) => {
    if (task.status !== 'resolved_booked' || !task.resolved_at) return false
    const resolvedMs = new Date(task.resolved_at).getTime()
    return Number.isFinite(resolvedMs) && resolvedMs >= followupWindowStartMs
  }).length
  const followupDueTodayCount = followupTaskRows.filter((task) => task.due_on === todayDateKey).length
  const followupResolvedThisWeek = followupTaskRows.filter((task) => {
    if (!task.resolved_at) return false
    const resolvedMs = new Date(task.resolved_at).getTime()
    return Number.isFinite(resolvedMs) && resolvedMs >= followupWindowStartMs
  }).length
  const followupResponseRate =
    followupTaskRows.length > 0 ? Math.round((followupTouchedCount / followupTaskRows.length) * 100) : 0
  const snoozedTaskIds = new Set(
    followupEventRows.filter((event) => event.event_type === 'snoozed').map((event) => event.task_id)
  )
  const followupRenotifyRate =
    followupTaskRows.length > 0 ? Math.round((snoozedTaskIds.size / followupTaskRows.length) * 100) : 0
  const followupBookedRate =
    followupResolvedThisWeek > 0 ? Math.round((followupBookedCount / followupResolvedThisWeek) * 100) : 0
  const followupLostCount = followupTaskRows.filter((task) => task.status === 'resolved_lost').length
  const followupNoNeedCount = followupTaskRows.filter((task) => task.status === 'resolved_no_need').length
  const followupUnreachableCount = followupTaskRows.filter(
    (task) => task.status === 'resolved_lost' && task.resolution_type === 'unreachable'
  ).length
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
  const reofferNotificationRows = ((reofferNotificationLogs ?? []) as CustomerNotificationDashboardRow[])
  const reofferWindowRows = reofferDashboardRows.filter((row) => {
    const baseValue = row.accepted_at ?? row.sent_at
    if (!baseValue) return false
    const baseMs = new Date(baseValue).getTime()
    return Number.isFinite(baseMs) && baseMs >= followupWindowStartMs
  })
  const reofferAcceptedCount = reofferDashboardRows.filter((row) => {
    if (!row.accepted_at) return false
    const acceptedMs = new Date(row.accepted_at).getTime()
    return Number.isFinite(acceptedMs) && acceptedMs >= followupWindowStartMs
  }).length
  const reofferAppointmentCreatedCount = reofferLogRows.filter((row) => {
    const createdMs = new Date(row.created_at).getTime()
    if (!Number.isFinite(createdMs) || createdMs < followupWindowStartMs) return false
    return row.event_type === 'accepted' && row.payload?.event_name === 'appointment_created'
  }).length
  const reofferBookedRate =
    reofferAcceptedCount > 0 ? Math.round((reofferAppointmentCreatedCount / reofferAcceptedCount) * 100) : 0
  const reofferPhoneContactCount = reofferNotificationRows.filter((row) => {
    const sentMs = new Date(row.sent_at).getTime()
    return Number.isFinite(sentMs) && sentMs >= followupWindowStartMs && row.channel === 'phone'
  }).length
  const reofferConnectedCallCount = reofferNotificationRows.filter((row) => {
    const sentMs = new Date(row.sent_at).getTime()
    return (
      Number.isFinite(sentMs) &&
      sentMs >= followupWindowStartMs &&
      row.channel === 'phone' &&
      row.payload?.result === 'connected'
    )
  }).length
  const staffNameByStaffId = new Map(followupStaffRows.map((staff) => [staff.id, staff.full_name]))
  const reofferCreatedById = new Set(
    reofferLogRows
      .filter((row) => row.event_type === 'accepted' && row.payload?.event_name === 'appointment_created')
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

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-600">
            情報を用途別に分けています。概要で全体確認し、必要な作業は各タブで進めます。
          </p>
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
            <Card><p className="text-xs text-gray-500">本日の予約件数</p><p className="text-2xl font-semibold text-gray-900">{((todayAppointments ?? []) as AppointmentRow[]).length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日の来店済み件数</p><p className="text-2xl font-semibold text-gray-900">{(todayVisits ?? []).length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日売上見込み</p><p className="text-2xl font-semibold text-gray-900">{formatYen(expectedTodaySales)}</p></Card>
            <Card><p className="text-xs text-gray-500">本日確定売上</p><p className="text-2xl font-semibold text-gray-900">{formatYen(confirmedTodaySales)}</p></Card>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Card className="border border-slate-200 bg-slate-900 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Today Focus</p>
                  <h2 className="text-2xl font-semibold">優先対応 {urgentActionCount} 件</h2>
                  <p className="text-sm text-slate-300">30分以内の予約、未会計、今日期限のフォローをまとめています。</p>
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
              <div className="mb-4"><h2 className="text-lg font-semibold text-gray-900">次の一手</h2><p className="text-sm text-gray-500">各業務タブへのショートカットです。</p></div>
              <div className="space-y-3">
                <Link href={buildDashboardHref('followups', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3"><div><p className="text-sm font-semibold text-sky-900">再来店フォロー</p><p className="text-xs text-sky-700">未着手 {followupOpenCount} 件 / 対応中 {followupInProgressCount} 件</p></div><span className="text-sm font-semibold text-sky-800">開く</span></Link>
                <Link href={buildDashboardHref('reoffers', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div><p className="text-sm font-semibold text-emerald-900">空き枠再販</p><p className="text-xs text-emerald-700">受付 {reofferAcceptedCount} 件 / 予約化 {reofferAppointmentCreatedCount} 件</p></div><span className="text-sm font-semibold text-emerald-800">開く</span></Link>
                <Link href={buildDashboardHref('operations', followupWindowDays)} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><div><p className="text-sm font-semibold text-amber-900">当日運用</p><p className="text-xs text-amber-700">近接予約 {within30MinAppointments.length} 件 / 未会計 {unpaidTodayAppointments.length} 件</p></div><span className="text-sm font-semibold text-amber-800">開く</span></Link>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">再来店対応率</p><p className="text-2xl font-semibold text-gray-900">{followupResponseRate}%</p><p className="text-xs text-gray-500">対応済み/全体: {followupTouchedCount}/{followupTaskRows.length}</p></Card>
            <Card><p className="text-xs text-gray-500">期間内の予約化</p><p className="text-2xl font-semibold text-gray-900">{followupBookedCount} 件</p><p className="text-xs text-gray-500">予約化率: {followupBookedRate}%</p></Card>
            <Card><p className="text-xs text-gray-500">再販受付件数</p><p className="text-2xl font-semibold text-gray-900">{reofferAcceptedCount} 件</p><p className="text-xs text-gray-500">直近{followupWindowDays}日</p></Card>
            <Card><p className="text-xs text-gray-500">再販から予約作成</p><p className="text-2xl font-semibold text-gray-900">{reofferAppointmentCreatedCount} 件</p><p className="text-xs text-gray-500">予約化率: {reofferBookedRate}%</p></Card>
          </div>
        </>
      ) : null}

      {activeTab === 'operations' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">30分以内の予約</p><p className="text-2xl font-semibold text-gray-900">{within30MinAppointments.length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">未会計アラート</p><p className="text-2xl font-semibold text-gray-900">{unpaidTodayAppointments.length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日の予約件数</p><p className="text-2xl font-semibold text-gray-900">{((todayAppointments ?? []) as AppointmentRow[]).length} 件</p></Card>
            <Card><p className="text-xs text-gray-500">本日確定売上</p><p className="text-2xl font-semibold text-gray-900">{formatYen(confirmedTodaySales)}</p></Card>
          </div>
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
          <p className="text-xs text-gray-500">再来店フォローKPIの集計期間: 直近{followupWindowDays}日</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">再来店フォロー未着手</p><p className="text-2xl font-semibold text-gray-900">{followupOpenCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">再来店フォロー対応中</p><p className="text-2xl font-semibold text-gray-900">{followupInProgressCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">再来店フォロー保留</p><p className="text-2xl font-semibold text-gray-900">{followupSnoozedCount} 件</p><p className="text-xs text-gray-500">今日期限: {followupDueTodayCount} 件</p></Card>
            <Card><p className="text-xs text-gray-500">期間内の予約化</p><p className="text-2xl font-semibold text-gray-900">{followupBookedCount} 件</p><p className="text-xs text-gray-500">予約化率: {followupBookedRate}%</p></Card>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">再来店対応率</p><p className="text-2xl font-semibold text-gray-900">{followupResponseRate}%</p><p className="text-xs text-gray-500">対応済み/全体: {followupTouchedCount}/{followupTaskRows.length}</p></Card>
            <Card><p className="text-xs text-gray-500">再通知率</p><p className="text-2xl font-semibold text-gray-900">{followupRenotifyRate}%</p><p className="text-xs text-gray-500">保留イベントあり: {snoozedTaskIds.size} 件</p></Card>
            <Card><p className="text-xs text-gray-500">失注/不要</p><p className="text-2xl font-semibold text-gray-900">{followupLostCount} / {followupNoNeedCount}</p><p className="text-xs text-gray-500">失注 / 不要</p></Card>
            <Card><p className="text-xs text-gray-500">連絡不能内訳</p><p className="text-2xl font-semibold text-gray-900">{followupUnreachableCount} 件</p><p className="text-xs text-gray-500">resolved_lost のうち unreachable</p></Card>
          </div>
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
          <p className="text-xs text-gray-500">空き枠再販KPIの集計期間: 直近{followupWindowDays}日</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-xs text-gray-500">再販受付件数</p><p className="text-2xl font-semibold text-gray-900">{reofferAcceptedCount} 件</p><p className="text-xs text-gray-500">直近{followupWindowDays}日で accepted</p></Card>
            <Card><p className="text-xs text-gray-500">再販から予約作成</p><p className="text-2xl font-semibold text-gray-900">{reofferAppointmentCreatedCount} 件</p><p className="text-xs text-gray-500">予約化率: {reofferBookedRate}%</p></Card>
            <Card><p className="text-xs text-gray-500">再販の電話結果</p><p className="text-2xl font-semibold text-gray-900">{reofferPhoneContactCount} 件</p><p className="text-xs text-gray-500">電話結果ログの記録件数</p></Card>
            <Card><p className="text-xs text-gray-500">電話接続件数</p><p className="text-2xl font-semibold text-gray-900">{reofferConnectedCallCount} 件</p><p className="text-xs text-gray-500">result=connected</p></Card>
          </div>
          <Card><SlotReofferPanel /></Card>
          <Card><NotificationTemplateEditor /></Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">担当者別 再販KPI</h2><p className="text-sm text-gray-500">直近{followupWindowDays}日基準</p></div>
            {reofferStaffStats.length === 0 ? <p className="text-sm text-gray-500">担当者別の再販データはまだありません。</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><th className="px-2 py-2">担当者</th><th className="px-2 py-2">総件数</th><th className="px-2 py-2">受付完了</th><th className="px-2 py-2">予約化</th><th className="px-2 py-2">予約化率</th></tr></thead><tbody className="divide-y">{reofferStaffStats.map((row) => (<tr key={row.name} className="text-gray-700"><td className="px-2 py-3 font-medium text-gray-900">{row.name}</td><td className="px-2 py-3">{row.total} 件</td><td className="px-2 py-3">{row.accepted} 件</td><td className="px-2 py-3">{row.booked} 件</td><td className="px-2 py-3">{row.bookedRate}%</td></tr>))}</tbody></table></div>}
          </Card>
        </>
      ) : null}
    </section>
  )
}
