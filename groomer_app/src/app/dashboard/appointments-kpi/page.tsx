import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { dashboardPageFixtures } from '@/lib/e2e/dashboard-page-fixtures'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type DailyMetricSummary = {
  dateKey: string
  label: string
  count: number
  avgElapsedMs: number
  avgClickCount: number
  copyRate: number
}

type AppointmentFormMetricDailySummaryRow = {
  date_key: string
  submission_count: number | null
  new_submission_count: number | null
  avg_elapsed_ms: number | null
  avg_click_count: number | null
  avg_field_change_count: number | null
  template_copy_rate: number | null
  new_avg_elapsed_ms: number | null
  new_avg_click_count: number | null
  new_avg_field_change_count: number | null
  new_template_copy_rate: number | null
}

type AppointmentDurationKpiDailySummaryRow = {
  date_key: string
  comparable_appointment_count: number | null
  avg_estimation_error_min: number | null
  within_10_min_count: number | null
}

type AppointmentStaffGapKpiDailySummaryRow = {
  date_key: string
  sequential_pair_count: number | null
  pushed_pair_count: number | null
}

type CompletedAppointmentDailySummaryRow = {
  date_key: string
  completed_count: number | null
}

type CompletedAppointmentRevisitSourceRow = {
  appointment_id: string
  has_next_booking: boolean | null
  is_revisit_leak: boolean | null
}

type NoShowCustomerKpiSourceRow = {
  customer_id: string
  no_show_count: number | null
  is_repeated_no_show: boolean | null
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

function getDateKeyDaysAgo(daysAgo: number) {
  const date = isPlaywrightE2E ? new Date(dashboardPageFixtures.nowIso) : new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return toJstDateKey(date.toISOString())
}

export default async function DashboardAppointmentsKpiPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: dashboardPageFixtures.storeId }
    : await createStoreScopedClient()
  const access = isPlaywrightE2E
    ? dashboardPageFixtures.kpiAccess
    : await requireStoreFeatureAccess({
        supabase,
        storeId,
        minimumPlan: 'pro',
      })
  if (!access.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">KPIレポート</h1>
        <Card>
          <p className="text-sm text-amber-700">{access.message}</p>
        </Card>
      </section>
    )
  }
  const metricsWindowStart = getDateKeyDaysAgo(29)
  const recentChartStart = getDateKeyDaysAgo(6)
  const formMetricSummaryRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiFormMetricSummaryRows
    : (
        await supabase!
          .from('appointment_form_metric_daily_summary_v')
          .select(
            'date_key, submission_count, new_submission_count, avg_elapsed_ms, avg_click_count, avg_field_change_count, template_copy_rate, new_avg_elapsed_ms, new_avg_click_count, new_avg_field_change_count, new_template_copy_rate'
          )
          .eq('store_id', storeId)
          .gte('date_key', metricsWindowStart)
          .order('date_key', { ascending: false })
      ).data
  const durationKpiRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiDurationKpiRows
    : (
        await supabase!
          .from('appointment_duration_kpi_daily_summary_v')
          .select('date_key, comparable_appointment_count, avg_estimation_error_min, within_10_min_count')
          .eq('store_id', storeId)
          .gte('date_key', metricsWindowStart)
          .order('date_key', { ascending: false })
      ).data
  const staffGapKpiRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiStaffGapKpiRows
    : (
        await supabase!
          .from('appointment_staff_gap_kpi_daily_summary_v')
          .select('date_key, sequential_pair_count, pushed_pair_count')
          .eq('store_id', storeId)
          .gte('date_key', metricsWindowStart)
          .order('date_key', { ascending: false })
      ).data
  const completedDailyRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiCompletedDailyRows
    : (
        await supabase!
          .from('completed_appointment_daily_summary_v')
          .select('date_key, completed_count')
          .eq('store_id', storeId)
          .gte('date_key', metricsWindowStart)
          .order('date_key', { ascending: false })
      ).data
  const completedRevisitRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiCompletedRevisitRows
    : (
        await supabase!
          .from('completed_appointment_revisit_source_v')
          .select('appointment_id, has_next_booking, is_revisit_leak')
          .eq('store_id', storeId)
          .order('start_time', { ascending: false })
          .limit(500)
      ).data
  const noShowCustomerRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiNoShowCustomerRows
    : (
        await supabase!
          .from('no_show_customer_kpi_source_v')
          .select('customer_id, no_show_count, is_repeated_no_show')
          .eq('store_id', storeId)
      ).data
  const appointmentRows = isPlaywrightE2E
    ? dashboardPageFixtures.kpiAppointmentRows
    : (
        await supabase!
          .from('appointments')
          .select('id, customer_id, pet_id, start_time, end_time, duration, status, staff_id')
          .eq('store_id', storeId)
          .order('start_time', { ascending: false })
          .limit(500)
      ).data

  const formMetrics = (formMetricSummaryRows ?? []) as AppointmentFormMetricDailySummaryRow[]
  const metricTarget = formMetrics
    .map((row) => {
      const newCount = row.new_submission_count ?? 0
      const totalCount = row.submission_count ?? 0
      const useNew = newCount > 0
      return {
        dateKey: row.date_key,
        count: useNew ? newCount : totalCount,
        avgElapsedMs: useNew ? row.new_avg_elapsed_ms ?? 0 : row.avg_elapsed_ms ?? 0,
        avgClickCount: useNew ? row.new_avg_click_count ?? 0 : row.avg_click_count ?? 0,
        avgFieldChangeCount: useNew ? row.new_avg_field_change_count ?? 0 : row.avg_field_change_count ?? 0,
        templateCopyRate: useNew ? row.new_template_copy_rate ?? 0 : row.template_copy_rate ?? 0,
      }
    })
    .filter((row) => row.count > 0)
  const metricCount = metricTarget.reduce((sum, row) => sum + row.count, 0)
  const avgElapsedMs =
    metricCount > 0
      ? Math.round(metricTarget.reduce((sum, row) => sum + row.avgElapsedMs * row.count, 0) / metricCount)
      : 0
  const avgClickCount =
    metricCount > 0
      ? Math.round(
          (metricTarget.reduce((sum, row) => sum + row.avgClickCount * row.count, 0) / metricCount) * 10
        ) / 10
      : 0
  const avgFieldChangeCount =
    metricCount > 0
      ? Math.round(
          (metricTarget.reduce((sum, row) => sum + row.avgFieldChangeCount * row.count, 0) / metricCount) * 10
        ) / 10
      : 0
  const templateCopyRate =
    metricCount > 0
      ? Math.round(metricTarget.reduce((sum, row) => sum + row.templateCopyRate * row.count, 0) / metricCount)
      : 0
  const avgElapsedLabel = formatMsToMinSec(avgElapsedMs)

  const dailySummaries: DailyMetricSummary[] = formMetrics
    .filter((row) => row.date_key >= recentChartStart)
    .sort((a, b) => (a.date_key > b.date_key ? 1 : -1))
    .slice(-7)
    .map((row) => {
      const useNew = (row.new_submission_count ?? 0) > 0
      const count = useNew ? row.new_submission_count ?? 0 : row.submission_count ?? 0
      const avgElapsed = useNew ? row.new_avg_elapsed_ms ?? 0 : row.avg_elapsed_ms ?? 0
      const avgClick = useNew ? row.new_avg_click_count ?? 0 : row.avg_click_count ?? 0
      const copyRate = useNew ? row.new_template_copy_rate ?? 0 : row.template_copy_rate ?? 0
      return {
        dateKey: row.date_key,
        label: row.date_key.slice(5).replace('-', '/'),
        count,
        avgElapsedMs: avgElapsed,
        avgClickCount: avgClick,
        copyRate,
      }
    })
    .filter((row) => row.count > 0)
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
  const durationKpis = (durationKpiRows ?? []) as AppointmentDurationKpiDailySummaryRow[]
  const durationComparableCount = durationKpis.reduce(
    (sum, row) => sum + (row.comparable_appointment_count ?? 0),
    0
  )
  const avgEstimationErrorMin =
    durationComparableCount > 0
      ? Math.round(
          (durationKpis.reduce(
            (sum, row) =>
              sum + (row.avg_estimation_error_min ?? 0) * (row.comparable_appointment_count ?? 0),
            0
          ) /
            durationComparableCount) *
            10
        ) / 10
      : 0
  const within10MinRate =
    durationComparableCount > 0
      ? Math.round(
          ((durationKpis.reduce((sum, row) => sum + (row.within_10_min_count ?? 0), 0) / durationComparableCount) *
            1000)
        ) / 10
      : 0

  const staffGapKpis = (staffGapKpiRows ?? []) as AppointmentStaffGapKpiDailySummaryRow[]
  const sequentialPairCount = staffGapKpis.reduce((sum, row) => sum + (row.sequential_pair_count ?? 0), 0)
  const pushedRate =
    sequentialPairCount > 0
      ? Math.round(
          ((staffGapKpis.reduce((sum, row) => sum + (row.pushed_pair_count ?? 0), 0) / sequentialPairCount) *
            1000)
        ) / 10
      : 0

  const completedDailySummaries = (completedDailyRows ?? []) as CompletedAppointmentDailySummaryRow[]
  const avgHandledPerDay =
    completedDailySummaries.length > 0
      ? Math.round(
          (completedDailySummaries.reduce((sum, row) => sum + (row.completed_count ?? 0), 0) /
            completedDailySummaries.length) *
            10
        ) / 10
      : 0

  const completedVisits = (completedRevisitRows ?? []) as CompletedAppointmentRevisitSourceRow[]
  const nextBookedCount = completedVisits.filter((row) => Boolean(row.has_next_booking)).length
  const nextReservationRate =
    completedVisits.length > 0 ? Math.round((nextBookedCount / completedVisits.length) * 1000) / 10 : 0

  const revisitLeakCount = completedVisits.filter((row) => Boolean(row.is_revisit_leak)).length

  const noShowCustomers = ((noShowCustomerRows ?? []) as NoShowCustomerKpiSourceRow[]).length
  const repeatedNoShowCustomers = ((noShowCustomerRows ?? []) as NoShowCustomerKpiSourceRow[]).filter((row) =>
    Boolean(row.is_repeated_no_show)
  ).length
  const noShowRecurrenceRate =
    noShowCustomers > 0 ? Math.round((repeatedNoShowCustomers / noShowCustomers) * 1000) / 10 : 0

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">KPIレポート</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">直近30日集計（新規優先）</h2>
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
            データがありません。
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
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">1日あたり処理件数</p>
            <p className="text-lg font-semibold text-gray-900">{avgHandledPerDay} 件/日</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">再来店運用KPI（直近500予約）</h2>
          <p className="text-xs text-gray-500">{completedVisits.length} 件</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">次回予約化率</p>
            <p className="text-lg font-semibold text-gray-900">{nextReservationRate}%</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">再来店漏れ件数</p>
            <p className="text-lg font-semibold text-gray-900">{revisitLeakCount} 件</p>
          </div>
          <div className="rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">無断キャンセル再発率</p>
            <p className="text-lg font-semibold text-gray-900">{noShowRecurrenceRate}%</p>
          </div>
        </div>
      </Card>
    </section>
  )
}
