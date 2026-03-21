import Link from 'next/link'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { OpsStatusActionForm } from '@/components/ops/OpsStatusActionForm'
import { OpsRevertStatusForm } from '@/components/ops/OpsRevertStatusForm'
import { opsPageFixtures } from '@/lib/e2e/ops-page-fixtures'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type AppointmentRow = {
  id: string
  customer_id: string
  pet_id: string
  staff_id: string
  start_time: string
  end_time: string
  menu: string | null
  status: string | null
  notes: string | null
  checked_in_at: string | null
  in_service_at: string | null
  payment_waiting_at: string | null
  completed_at: string | null
  customers?:
    | { id?: string | null; full_name: string | null; line_id?: string | null }
    | Array<{ id?: string | null; full_name: string | null; line_id?: string | null }>
    | null
  pets?: { name: string | null } | Array<{ name: string | null }> | null
  staffs?: { full_name: string | null } | Array<{ full_name: string | null }> | null
}

type PaymentRow = {
  appointment_id: string | null
  paid_at: string | null
}

type MedicalRecordRow = {
  appointment_id: string | null
}

const statusFlowActions = {
  予約済: { nextStatus: '受付', label: '受付開始' },
  受付: { nextStatus: '施術中', label: '施術開始' },
  施術中: { nextStatus: '会計待ち', label: '会計待ちへ' },
  会計待ち: { nextStatus: '完了', label: '完了' },
} as const

function normalizeStatus(status: string | null | undefined) {
  if (status === '来店済') return '完了'
  return status ?? '予約済'
}

function getNextStatusAction(status: string | null | undefined) {
  const normalized = normalizeStatus(status)
  return statusFlowActions[normalized as keyof typeof statusFlowActions] ?? null
}

function getRelatedValue<T extends Record<string, string | null>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

function getTodayRangeJst() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth()
  const d = jst.getUTCDate()
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000)
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - 9 * 60 * 60 * 1000)
  return { startIso: start.toISOString(), endIso: end.toISOString(), nowMs: now.getTime() }
}

function formatTimeJst(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function toDurationMinutes(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.round((end - start) / (60 * 1000))
}

export default async function OpsTodayPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: opsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const { startIso, endIso, nowMs } = getTodayRangeJst()

  const data = isPlaywrightE2E
    ? opsPageFixtures.appointments
    : (
        await db
          .from('appointments')
          .select(
            'id, customer_id, pet_id, staff_id, start_time, end_time, menu, status, notes, checked_in_at, in_service_at, payment_waiting_at, completed_at, customers(id, full_name, line_id), pets(name), staffs(full_name)'
          )
          .eq('store_id', storeId)
          .gte('start_time', startIso)
          .lt('start_time', endIso)
          .neq('status', 'キャンセル')
          .neq('status', '無断キャンセル')
          .order('start_time', { ascending: true })
      ).data

  const appointments = (data ?? []) as AppointmentRow[]
  const appointmentIds = appointments.map((row) => row.id)

  const [paymentRows, medicalRecordRows] = isPlaywrightE2E
    ? [opsPageFixtures.payments, opsPageFixtures.medicalRecords]
    : await Promise.all([
        appointmentIds.length > 0
          ? db
              .from('payments')
              .select('appointment_id, paid_at')
              .eq('store_id', storeId)
              .in('appointment_id', appointmentIds)
              .then((result) => result.data ?? [])
          : Promise.resolve([] as PaymentRow[]),
        appointmentIds.length > 0
          ? db
              .from('medical_records')
              .select('appointment_id')
              .eq('store_id', storeId)
              .in('appointment_id', appointmentIds)
              .then((result) => result.data ?? [])
          : Promise.resolve([] as MedicalRecordRow[]),
      ])

  const paidAppointmentIds = new Set(
    ((paymentRows ?? []) as PaymentRow[])
      .filter((row) => Boolean(row.appointment_id) && Boolean(row.paid_at))
      .map((row) => row.appointment_id as string)
  )
  const medicalRecordAppointmentIds = new Set(
    ((medicalRecordRows ?? []) as MedicalRecordRow[])
      .filter((row) => Boolean(row.appointment_id))
      .map((row) => row.appointment_id as string)
  )
  const revertedCount = isPlaywrightE2E
    ? opsPageFixtures.revertedCount
    : (
        await db
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('entity_type', 'appointment')
          .eq('action', 'status_reverted')
          .gte('created_at', startIso)
          .lt('created_at', endIso)
      ).count

  const delayedCount = appointments.filter((appointment) => {
    const status = normalizeStatus(appointment.status)
    if (status === '完了') return false
    return new Date(appointment.start_time).getTime() < (isPlaywrightE2E ? opsPageFixtures.nowMs : nowMs)
  }).length

  const completedDurations = appointments
    .map((appointment) => toDurationMinutes(appointment.checked_in_at, appointment.completed_at))
    .filter((value): value is number => value !== null)
  const avgTransitionMinutes =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length
        )
      : null

  return (
    <section className="space-y-4 pb-28">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">当日運用（モバイル）</h1>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">遷移平均時間</p>
          <p className="text-lg font-semibold text-gray-900">
            {avgTransitionMinutes !== null ? `${avgTransitionMinutes} 分` : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">遅延件数</p>
          <p className="text-lg font-semibold text-gray-900">{delayedCount} 件</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">差し戻し回数（本日）</p>
          <p className="text-lg font-semibold text-gray-900">{revertedCount ?? 0} 件</p>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          本日の対象予約はありません。
        </div>
      ) : (
        <div className="space-y-3" data-testid="ops-today-list">
          {appointments.map((appointment) => {
            const action = getNextStatusAction(appointment.status)
            const normalizedStatus = normalizeStatus(appointment.status)
            const isPaid = paidAppointmentIds.has(appointment.id)
            const hasMedicalRecord = medicalRecordAppointmentIds.has(appointment.id)
            const customerLineId = getRelatedValue(appointment.customers, 'line_id')
            const hasLineId = customerLineId !== '未登録'
            return (
              <article
                key={appointment.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                data-testid={`ops-card-${appointment.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      {formatTimeJst(appointment.start_time)} - {formatTimeJst(appointment.end_time)}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {getRelatedValue(appointment.pets, 'name')}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {normalizedStatus}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  <p>顧客: {getRelatedValue(appointment.customers, 'full_name')}</p>
                  <p>担当: {getRelatedValue(appointment.staffs, 'full_name')}</p>
                  <p>メニュー: {appointment.menu ?? '未設定'}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!isPaid ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        未会計
                      </span>
                    ) : null}
                    {!hasMedicalRecord ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                        カルテ未作成
                      </span>
                    ) : null}
                  </div>
                  {appointment.notes ? <p>備考: {appointment.notes}</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {action ? (
                    <OpsStatusActionForm
                      appointmentId={appointment.id}
                      nextStatus={action.nextStatus}
                      label={action.label}
                    />
                  ) : null}
                  {normalizedStatus === '完了' ? (
                    <OpsRevertStatusForm appointmentId={appointment.id} />
                  ) : null}
                  <Link
                    href={`/payments?tab=list&modal=create&appointment_id=${appointment.id}`}
                    className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700"
                  >
                    会計
                  </Link>
                  <Link
                    href={`/medical-records?tab=list&modal=create&appointment_id=${appointment.id}`}
                    className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
                  >
                    カルテ
                  </Link>
                  <Link
                    href={`/customers?tab=list&edit=${appointment.customer_id}`}
                    className="rounded border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700"
                  >
                    {hasLineId ? 'LINE送信（顧客編集）' : 'LINE ID登録'}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Link href="/dashboard?tab=operations" className="rounded border px-3 py-2 text-sm text-gray-700">
            当日ダッシュボード
          </Link>
          <Link href="/payments?tab=list&modal=create" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
            会計を開く
          </Link>
        </div>
      </div>
    </section>
  )
}
