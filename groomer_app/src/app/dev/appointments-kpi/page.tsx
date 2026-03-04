import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { APPOINTMENT_METRIC_EVENTS } from '@/lib/appointments/metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AppointmentMetricRow = {
  created_at: string
  mode: string
  elapsed_ms: number
  click_count: number
  field_change_count: number
  used_template_copy: boolean
}

type DailyMetricSummary = {
  dateKey: string
  label: string
  count: number
  avgElapsedMs: number
  avgClickCount: number
  copyRate: number
}

type AppointmentKpiSourceRow = {
  id: string
  customer_id: string | null
  pet_id: string | null
  start_time: string | null
  end_time: string | null
  duration: number | null
  status: string | null
  staff_id: string | null
}

function isCompletedAppointmentStatus(status: string | null | undefined) {
  return status === '来店済' || status === '完了'
}

function toJstDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function formatMsToMinSec(ms: number) {
  if (ms <= 0) return '-'
  return `${Math.floor(ms / 60000)}分${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}秒`
}

function toMinutesBetween(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (60 * 1000)))
}

export default async function DevAppointmentsKpiPage() {
  const nowMs = new Date().getTime()
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">予約作成KPI</h1>
        <Card>
          <p className="text-sm text-red-700">このページは開発者管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const { data: metricRows } = await supabase
    .from('appointment_metrics')
    .select('created_at, mode, elapsed_ms, click_count, field_change_count, used_template_copy')
    .eq('store_id', storeId)
    .eq('event_type', APPOINTMENT_METRIC_EVENTS.appointmentFormSubmit)
    .order('created_at', { ascending: false })
    .limit(100)
  const { data: appointmentRows } = await supabase
    .from('appointments')
    .select('id, customer_id, pet_id, start_time, end_time, duration, status, staff_id')
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })
    .limit(500)

  const metrics = (metricRows ?? []) as AppointmentMetricRow[]
  const newMetrics = metrics.filter((row) => row.mode === 'new')
  const metricTarget = newMetrics.length > 0 ? newMetrics : metrics
  const metricCount = metricTarget.length
  const avgElapsedMs =
    metricCount > 0
      ? Math.round(metricTarget.reduce((sum, row) => sum + (row.elapsed_ms ?? 0), 0) / metricCount)
      : 0
  const avgClickCount =
    metricCount > 0
      ? Math.round((metricTarget.reduce((sum, row) => sum + (row.click_count ?? 0), 0) / metricCount) * 10) /
        10
      : 0
  const avgFieldChangeCount =
    metricCount > 0
      ? Math.round(
          (metricTarget.reduce((sum, row) => sum + (row.field_change_count ?? 0), 0) / metricCount) * 10
        ) / 10
      : 0
  const templateCopyRate =
    metricCount > 0
      ? Math.round((metricTarget.filter((row) => row.used_template_copy).length / metricCount) * 100)
      : 0
  const avgElapsedLabel = formatMsToMinSec(avgElapsedMs)

  const dailyMap = new Map<string, AppointmentMetricRow[]>()
  metricTarget.forEach((row) => {
    const key = toJstDateKey(row.created_at)
    if (!key) return
    const list = dailyMap.get(key) ?? []
    list.push(row)
    dailyMap.set(key, list)
  })
  const dailySummaries: DailyMetricSummary[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 7)
    .map(([dateKey, rows]) => {
      const count = rows.length
      const avgElapsed =
        count > 0 ? Math.round(rows.reduce((sum, row) => sum + (row.elapsed_ms ?? 0), 0) / count) : 0
      const avgClick =
        count > 0
          ? Math.round((rows.reduce((sum, row) => sum + (row.click_count ?? 0), 0) / count) * 10) / 10
          : 0
      const copyRate =
        count > 0 ? Math.round((rows.filter((row) => row.used_template_copy).length / count) * 100) : 0
      return {
        dateKey,
        label: dateKey.slice(5).replace('-', '/'),
        count,
        avgElapsedMs: avgElapsed,
        avgClickCount: avgClick,
        copyRate,
      }
    })
    .reverse()
  const dailyMaxElapsed = dailySummaries.reduce(
    (max, row) => (row.avgElapsedMs > max ? row.avgElapsedMs : max),
    0
  )
  const dailyMaxClick = dailySummaries.reduce(
    (max, row) => (row.avgClickCount > max ? row.avgClickCount : max),
    0
  )

  const appointmentMetrics = (appointmentRows ?? []) as AppointmentKpiSourceRow[]
  const activeAppointments = appointmentMetrics.filter(
    (row) => row.status !== 'キャンセル' && row.status !== '無断キャンセル'
  )

  const estimationErrors = activeAppointments
    .map((row) => {
      const slotMin = toMinutesBetween(row.start_time, row.end_time)
      const estimatedMin = row.duration ?? 0
      if (slotMin === null || estimatedMin <= 0) return null
      return Math.abs(slotMin - estimatedMin)
    })
    .filter((value): value is number => typeof value === 'number')
  const avgEstimationErrorMin =
    estimationErrors.length > 0
      ? Math.round((estimationErrors.reduce((sum, value) => sum + value, 0) / estimationErrors.length) * 10) /
        10
      : 0
  const within10MinRate =
    estimationErrors.length > 0
      ? Math.round((estimationErrors.filter((value) => value <= 10).length / estimationErrors.length) * 100)
      : 0

  const staffDayMap = new Map<string, AppointmentKpiSourceRow[]>()
  activeAppointments.forEach((row) => {
    if (!row.staff_id || !row.start_time) return
    const dayKey = toJstDateKey(row.start_time)
    if (!dayKey) return
    const mapKey = `${row.staff_id}:${dayKey}`
    const list = staffDayMap.get(mapKey) ?? []
    list.push(row)
    staffDayMap.set(mapKey, list)
  })

  let totalSequentialPairs = 0
  let pushedPairs = 0
  staffDayMap.forEach((rows) => {
    const sorted = [...rows].sort((a, b) => {
      const aTime = new Date(a.start_time ?? '').getTime()
      const bTime = new Date(b.start_time ?? '').getTime()
      return aTime - bTime
    })
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]
      const current = sorted[i]
      const prevEnd = new Date(prev.end_time ?? '').getTime()
      const currentStart = new Date(current.start_time ?? '').getTime()
      if (!Number.isFinite(prevEnd) || !Number.isFinite(currentStart)) continue
      totalSequentialPairs += 1
      const gapMin = Math.round((currentStart - prevEnd) / (60 * 1000))
      if (gapMin < 10) {
        pushedPairs += 1
      }
    }
  })
  const pushedRate =
    totalSequentialPairs > 0 ? Math.round((pushedPairs / totalSequentialPairs) * 1000) / 10 : 0

  const completedDailyMap = new Map<string, number>()
  activeAppointments
    .filter((row) => isCompletedAppointmentStatus(row.status))
    .forEach((row) => {
      if (!row.start_time) return
      const dayKey = toJstDateKey(row.start_time)
      if (!dayKey) return
      completedDailyMap.set(dayKey, (completedDailyMap.get(dayKey) ?? 0) + 1)
    })
  const avgHandledPerDay =
    completedDailyMap.size > 0
      ? Math.round(
          (Array.from(completedDailyMap.values()).reduce((sum, value) => sum + value, 0) /
            completedDailyMap.size) *
            10
        ) / 10
      : 0

  const completedVisits = appointmentMetrics.filter(
    (row) =>
      isCompletedAppointmentStatus(row.status) &&
      row.customer_id &&
      row.pet_id &&
      row.start_time &&
      !Number.isNaN(new Date(row.start_time).getTime())
  )
  const hasNextBooking = (base: AppointmentKpiSourceRow) => {
    if (!base.customer_id || !base.pet_id || !base.start_time) return false
    const baseTime = new Date(base.start_time).getTime()
    return appointmentMetrics.some((candidate) => {
      if (candidate.id === base.id) return false
      if (candidate.customer_id !== base.customer_id || candidate.pet_id !== base.pet_id) return false
      if (!candidate.start_time) return false
      if (candidate.status === 'キャンセル' || candidate.status === '無断キャンセル') return false
      const candidateTime = new Date(candidate.start_time).getTime()
      if (!Number.isFinite(candidateTime)) return false
      return candidateTime > baseTime
    })
  }
  const nextBookedCount = completedVisits.filter((row) => hasNextBooking(row)).length
  const nextReservationRate =
    completedVisits.length > 0 ? Math.round((nextBookedCount / completedVisits.length) * 1000) / 10 : 0

  const revisitLeakCount = completedVisits.filter((row) => {
    if (hasNextBooking(row)) return false
    const visitAt = new Date(row.start_time ?? '').getTime()
    if (!Number.isFinite(visitAt)) return false
    const daysSinceVisit = Math.floor((nowMs - visitAt) / (24 * 60 * 60 * 1000))
    return daysSinceVisit >= 45
  }).length

  const noShowCountByCustomer = appointmentMetrics.reduce(
    (acc, row) => {
      if (row.customer_id && row.status === '無断キャンセル') {
        acc[row.customer_id] = (acc[row.customer_id] ?? 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )
  const noShowCustomerCounts = Object.values(noShowCountByCustomer)
  const noShowCustomers = noShowCustomerCounts.length
  const repeatedNoShowCustomers = noShowCustomerCounts.filter((count) => count >= 2).length
  const noShowRecurrenceRate =
    noShowCustomers > 0 ? Math.round((repeatedNoShowCustomers / noShowCustomers) * 1000) / 10 : 0

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">予約作成KPI</h1>
        <p className="text-sm text-gray-600">アクティブ店舗の予約入力効率を監視します。</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">直近100件（新規優先）</h2>
          <p className="text-xs text-gray-500">{metricCount} 件</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">平均作成時間</p>
            <p className="text-lg font-semibold text-gray-900">{avgElapsedLabel}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">平均クリック数</p>
            <p className="text-lg font-semibold text-gray-900">{avgClickCount}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">平均入力変更数</p>
            <p className="text-lg font-semibold text-gray-900">{avgFieldChangeCount}</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">前回コピー利用率</p>
            <p className="text-lg font-semibold text-gray-900">{templateCopyRate}%</p>
          </div>
        </div>

        {dailySummaries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">日次推移（記録のある直近7日）</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-blue-500" />
                平均作成時間（バー）
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-emerald-500" />
                平均クリック数（折れ線）
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-amber-500" />
                前回コピー利用率（折れ線）
              </span>
            </div>
            <div className="overflow-x-auto rounded border bg-gray-50 p-3">
              <div
                className="relative"
                style={{
                  width: `${Math.max(320, dailySummaries.length * 56)}px`,
                  height: '130px',
                }}
              >
                {dailySummaries.map((row, index) => {
                  const centerX = index * 56 + 28
                  const barHeight =
                    dailyMaxElapsed > 0 ? Math.max(10, Math.round((row.avgElapsedMs / dailyMaxElapsed) * 72)) : 10
                  const clickY =
                    dailyMaxClick > 0 ? 80 - (row.avgClickCount / dailyMaxClick) * 72 : 80
                  const copyY = 80 - (row.copyRate / 100) * 72
                  return (
                    <div key={row.dateKey}>
                      <div
                        className="absolute w-5 -translate-x-1/2 rounded-t bg-blue-500"
                        style={{
                          left: `${centerX}px`,
                          bottom: '24px',
                          height: `${barHeight}px`,
                        }}
                        title={`平均作成時間: ${formatMsToMinSec(row.avgElapsedMs)}`}
                      />
                      <div
                        className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-500"
                        style={{ left: `${centerX}px`, top: `${clickY}px` }}
                        title={`平均クリック数: ${row.avgClickCount}`}
                      />
                      <div
                        className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-amber-500"
                        style={{ left: `${centerX}px`, top: `${copyY}px` }}
                        title={`前回コピー利用率: ${row.copyRate}%`}
                      />
                      <div
                        className="absolute -translate-x-1/2 text-[10px] text-gray-700"
                        style={{ left: `${centerX}px`, bottom: '0px' }}
                      >
                        {row.label}
                      </div>
                    </div>
                  )
                })}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  viewBox={`0 0 ${Math.max(320, dailySummaries.length * 56)} 130`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={dailySummaries
                      .map((row, index) => {
                        const x = index * 56 + 28
                        const y =
                          dailyMaxClick > 0 ? 80 - (row.avgClickCount / dailyMaxClick) * 72 : 80
                        return `${x},${y}`
                      })
                      .join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    points={dailySummaries
                      .map((row, index) => {
                        const x = index * 56 + 28
                        const y = 80 - (row.copyRate / 100) * 72
                        return `${x},${y}`
                      })
                      .join(' ')}
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed bg-gray-50 p-3 text-xs text-gray-600">
            日次推移を表示するデータがまだありません。予約を保存すると計測が蓄積されます。
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">所要時間自動化KPI（直近500予約）</h2>
          <p className="text-xs text-gray-500">{activeAppointments.length} 件（キャンセル除外）</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">時間見積もり誤差（平均）</p>
            <p className="text-lg font-semibold text-gray-900">{avgEstimationErrorMin} 分</p>
            <p className="text-xs text-gray-500">±10分以内: {within10MinRate}%</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">押し予約発生率</p>
            <p className="text-lg font-semibold text-gray-900">{pushedRate}%</p>
            <p className="text-xs text-gray-500">判定: 同一スタッフ連続予約の間隔が10分未満</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">1日あたり処理件数</p>
            <p className="text-lg font-semibold text-gray-900">{avgHandledPerDay} 件/日</p>
            <p className="text-xs text-gray-500">対象: ステータス「完了/来店済」</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">再来店運用KPI（直近500予約）</h2>
          <p className="text-xs text-gray-500">母数: 完了/来店済 {completedVisits.length} 件</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">次回予約化率</p>
            <p className="text-lg font-semibold text-gray-900">{nextReservationRate}%</p>
            <p className="text-xs text-gray-500">完了/来店済のうち後続予約あり: {nextBookedCount} 件</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">再来店漏れ件数</p>
            <p className="text-lg font-semibold text-gray-900">{revisitLeakCount} 件</p>
            <p className="text-xs text-gray-500">完了/来店済から45日以上かつ後続予約なし</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">無断キャンセル再発率</p>
            <p className="text-lg font-semibold text-gray-900">{noShowRecurrenceRate}%</p>
            <p className="text-xs text-gray-500">
              無断キャンセル経験顧客 {noShowCustomers} 人中、再発 {repeatedNoShowCustomers} 人
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}
