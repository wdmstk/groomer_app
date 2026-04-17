import { Card } from '@/components/ui/Card'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'
import { getSettingsManageLabel } from '@/lib/settings/presentation'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
const WEEKDAY_OPTIONS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
] as const

type MembershipRole = 'owner' | 'admin' | 'staff'

export default async function StoreOperationsSettingsContent() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: settingsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const manageState = isPlaywrightE2E
    ? settingsPageFixtures.manageState
    : (() => {
        return db.auth.getUser().then(async ({ data: { user } }) => {
          const membership = user
            ? (
                await db
                  .from('store_memberships')
                  .select('role')
                  .eq('store_id', storeId)
                  .eq('user_id', user.id)
                  .eq('is_active', true)
                  .maybeSingle()
              ).data
            : null
          const currentRole = (membership?.role as MembershipRole | undefined) ?? null
          return getSettingsManageLabel(currentRole)
        })
      })()
  const resolvedManageState = await manageState
  const canManage = resolvedManageState.canManage

  const storeSettings = isPlaywrightE2E
    ? settingsPageFixtures.publicReserveSettings
    : (
        await db
          .from('stores')
          .select(
            'public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes, member_card_rank_visible, member_portal_ttl_days, ltv_gold_annual_sales_threshold, ltv_silver_annual_sales_threshold, ltv_bronze_annual_sales_threshold, ltv_gold_visit_count_threshold, ltv_silver_visit_count_threshold, ltv_bronze_visit_count_threshold'
          )
          .eq('id', storeId)
          .maybeSingle()
      ).data

  const shiftSettings = isPlaywrightE2E
    ? {
        attendance_punch_enabled: true,
        attendance_location_required: false,
        attendance_location_lat: null,
        attendance_location_lng: null,
        attendance_location_radius_meters: 200,
      }
    : (
        await db
          .from('store_shift_settings')
          .select(
            'attendance_punch_enabled, attendance_location_required, attendance_location_lat, attendance_location_lng, attendance_location_radius_meters'
          )
          .eq('store_id', storeId)
          .maybeSingle()
      ).data
  const closedRules = isPlaywrightE2E
    ? settingsPageFixtures.blockedDates.map((item) => ({
        rule_type: 'date',
        weekday: null,
        closed_date: item.date_key,
      }))
    : (
        await db
          .from('store_closed_rules')
          .select('rule_type, weekday, closed_date')
          .eq('store_id', storeId)
          .eq('is_active', true)
      ).data

  const customerManagementSettings = isPlaywrightE2E
    ? settingsPageFixtures.customerManagementSettings
    : (
        await db
          .from('store_customer_management_settings' as never)
          .select(
            'medical_record_list_limit, journal_visibility_mode, calendar_expand_out_of_range_appointments, followup_snoozed_refollow_days, followup_no_need_refollow_days, followup_lost_refollow_days'
          )
          .eq('store_id', storeId)
          .maybeSingle()
      ).data as
        | {
            medical_record_list_limit?: number | null
            journal_visibility_mode?: string | null
            calendar_expand_out_of_range_appointments?: boolean | null
            followup_snoozed_refollow_days?: number | null
            followup_no_need_refollow_days?: number | null
            followup_lost_refollow_days?: number | null
          }
        | null

  const publicReserveSlotDays = Number(storeSettings?.public_reserve_slot_days ?? 7) || 7
  const publicReserveSlotIntervalMinutes =
    Number(storeSettings?.public_reserve_slot_interval_minutes ?? 30) || 30
  const publicReserveSlotBufferMinutes =
    Number(storeSettings?.public_reserve_slot_buffer_minutes ?? 15) || 15
  const publicReserveBusinessStartHourJst =
    Number(storeSettings?.public_reserve_business_start_hour_jst ?? 9) || 9
  const publicReserveBusinessEndHourJst =
    Number(storeSettings?.public_reserve_business_end_hour_jst ?? 19) || 19
  const publicReserveMinLeadMinutes =
    Number(storeSettings?.public_reserve_min_lead_minutes ?? 60) || 60
  const memberCardRankVisible = storeSettings?.member_card_rank_visible !== false
  const memberPortalTtlDays = (() => {
    const raw = Number(storeSettings?.member_portal_ttl_days ?? 90)
    return raw === 30 || raw === 180 ? raw : 90
  })()
  const ltvGoldAnnualSalesThreshold = Number(storeSettings?.ltv_gold_annual_sales_threshold ?? 120000) || 120000
  const ltvSilverAnnualSalesThreshold =
    Number(storeSettings?.ltv_silver_annual_sales_threshold ?? 60000) || 60000
  const ltvBronzeAnnualSalesThreshold =
    Number(storeSettings?.ltv_bronze_annual_sales_threshold ?? 30000) || 30000
  const ltvGoldVisitCountThreshold = Number(storeSettings?.ltv_gold_visit_count_threshold ?? 12) || 12
  const ltvSilverVisitCountThreshold = Number(storeSettings?.ltv_silver_visit_count_threshold ?? 6) || 6
  const ltvBronzeVisitCountThreshold = Number(storeSettings?.ltv_bronze_visit_count_threshold ?? 3) || 3
  const medicalRecordListLimit = Math.max(
    5,
    Math.min(100, Number(customerManagementSettings?.medical_record_list_limit ?? 10))
  )
  const journalVisibilityMode =
    customerManagementSettings?.journal_visibility_mode === 'include_drafts'
      ? 'include_drafts'
      : 'published_only'
  const calendarExpandOutOfRangeAppointments =
    customerManagementSettings?.calendar_expand_out_of_range_appointments === true
  const followupSnoozedRefollowDays = Math.max(
    1,
    Math.min(365, Number(customerManagementSettings?.followup_snoozed_refollow_days ?? 7))
  )
  const followupNoNeedRefollowDays = Math.max(
    1,
    Math.min(365, Number(customerManagementSettings?.followup_no_need_refollow_days ?? 60))
  )
  const followupLostRefollowDays = Math.max(
    1,
    Math.min(365, Number(customerManagementSettings?.followup_lost_refollow_days ?? 90))
  )
  const attendancePunchEnabled = (shiftSettings?.attendance_punch_enabled ?? true) !== false
  const attendanceLocationRequired = shiftSettings?.attendance_location_required === true
  const attendanceLocationLat =
    typeof shiftSettings?.attendance_location_lat === 'number'
      ? shiftSettings.attendance_location_lat
      : shiftSettings?.attendance_location_lat
        ? Number(shiftSettings.attendance_location_lat)
        : null
  const attendanceLocationLng =
    typeof shiftSettings?.attendance_location_lng === 'number'
      ? shiftSettings.attendance_location_lng
      : shiftSettings?.attendance_location_lng
        ? Number(shiftSettings.attendance_location_lng)
        : null
  const attendanceLocationRadiusMeters = Math.max(
    1,
    Math.min(5000, Number(shiftSettings?.attendance_location_radius_meters ?? 200))
  )
  const closedWeekdays = new Set(
    ((closedRules ?? []) as Array<{ rule_type: string | null; weekday: number | null }>)
      .filter((rule) => rule.rule_type === 'weekday' && Number.isInteger(rule.weekday))
      .map((rule) => Number(rule.weekday))
  )
  const closedDatesText = ((closedRules ?? []) as Array<{ rule_type: string | null; closed_date: string | null }>)
    .filter((rule) => rule.rule_type === 'date' && typeof rule.closed_date === 'string' && rule.closed_date.length > 0)
    .map((rule) => String(rule.closed_date))
    .sort()
    .join('\n')

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">店舗運用設定</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
          営業時間・休業日・会員証・LTVランク・顧客ペット管理の表示設定を管理します。
        </p>
      </div>

      {!canManage ? (
        <Card>
          <p className="text-sm text-gray-700 dark:text-slate-300">
            このページは閲覧のみ可能です。設定変更は owner/admin ロールで実行してください。
          </p>
        </Card>
      ) : null}

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">営業時間</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
            予約カレンダーの表示は営業時間の前後1時間です（例: 9:00-19:00 の場合は 8:00-20:00）。
          </p>
          <form
            action="/api/stores/public-reserve-slot-settings"
            method="post"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <label className="text-xs text-gray-700 dark:text-slate-300">
              営業開始時刻（JST 時）
              <input
                type="number"
                min={0}
                max={23}
                name="public_reserve_business_start_hour_jst"
                defaultValue={publicReserveBusinessStartHourJst}
                className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700 dark:text-slate-300">
              営業終了時刻（JST 時）
              <input
                type="number"
                min={1}
                max={24}
                name="public_reserve_business_end_hour_jst"
                defaultValue={publicReserveBusinessEndHourJst}
                className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={!canManage}
              />
            </label>
            <div className="flex flex-col justify-end gap-3">
              <input type="hidden" name="public_reserve_slot_days" value={publicReserveSlotDays} />
              <input
                type="hidden"
                name="public_reserve_slot_interval_minutes"
                value={publicReserveSlotIntervalMinutes}
              />
              <input
                type="hidden"
                name="public_reserve_slot_buffer_minutes"
                value={publicReserveSlotBufferMinutes}
              />
              <input type="hidden" name="public_reserve_min_lead_minutes" value={publicReserveMinLeadMinutes} />
              <input type="hidden" name="medical_record_list_limit" value={medicalRecordListLimit} />
              <input type="hidden" name="journal_visibility_mode" value={journalVisibilityMode} />
              <input type="hidden" name="followup_snoozed_refollow_days" value={followupSnoozedRefollowDays} />
              <input type="hidden" name="followup_no_need_refollow_days" value={followupNoNeedRefollowDays} />
              <input type="hidden" name="followup_lost_refollow_days" value={followupLostRefollowDays} />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input type="hidden" name="calendar_expand_out_of_range_appointments" value="false" />
                <input
                  type="checkbox"
                  name="calendar_expand_out_of_range_appointments"
                  value="true"
                  defaultChecked={calendarExpandOutOfRangeAppointments}
                  disabled={!canManage}
                />
                予約表示範囲外の予約がある場合は範囲を自動拡張
              </label>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                営業時間・カレンダー表示設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">定休日設定</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
            シフト生成と公開予約の両方で共通利用する定休日（曜日・日付）を設定します。
          </p>
          <form action="/api/stores/shift-attendance-settings" method="post" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border border-gray-200 p-3 dark:border-slate-700">
                <p className="text-xs font-semibold text-gray-900 dark:text-slate-200">定休日（曜日）</p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">選択した曜日を毎週の定休日として扱います。</p>
                <div className="mt-2 rounded border border-gray-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                  <div className="flex flex-col gap-1.5">
                    {WEEKDAY_OPTIONS.map((weekday) => (
                      <label
                        key={`closed-weekday-${weekday.value}`}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300"
                      >
                        <input
                          type="checkbox"
                          name="closed_weekdays"
                          value={String(weekday.value)}
                          defaultChecked={closedWeekdays.has(weekday.value)}
                          disabled={!canManage}
                        />
                        {weekday.value}（{weekday.label}）
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded border border-gray-200 p-3 dark:border-slate-700">
                <label className="block text-xs text-gray-700 dark:text-slate-300">
                  <span className="font-semibold text-gray-900 dark:text-slate-200">定休日（日付）</span>
                  <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">臨時休業日などを `YYYY-MM-DD` で改行入力します。</span>
                  <textarea
                    name="closed_dates_text"
                    defaultValue={closedDatesText}
                    placeholder={'2026-03-20\n2026-03-21'}
                    className="mt-2 min-h-[230px] w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    disabled={!canManage}
                  />
                </label>
              </div>
            </div>
            <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
            <button
              type="submit"
              disabled={!canManage}
              className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              定休日設定を保存
            </button>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">勤怠打刻設定</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
            勤怠打刻機能と打刻時の位置情報取得の設定を管理します。
          </p>
          <form action="/api/stores/shift-attendance-settings" method="post" className="space-y-3">
            <div className="rounded border border-gray-200 p-3 dark:border-slate-700">
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                  <input type="hidden" name="attendance_punch_enabled" value="false" />
                  <input
                    type="checkbox"
                    name="attendance_punch_enabled"
                    value="true"
                    defaultChecked={attendancePunchEnabled}
                    disabled={!canManage}
                  />
                  勤怠打刻を有効化（勤務実績確認も有効）
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                  <input type="hidden" name="attendance_location_required" value="false" />
                  <input
                    type="checkbox"
                    name="attendance_location_required"
                    value="true"
                    defaultChecked={attendanceLocationRequired}
                    disabled={!canManage}
                  />
                  打刻時に位置情報の取得を必須にする
                </label>
                <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3">
                  <label className="text-xs text-gray-700 dark:text-slate-300">
                    基準緯度 (lat)
                    <input
                      type="number"
                      name="attendance_location_lat"
                      step="0.0000001"
                      min={-90}
                      max={90}
                      defaultValue={attendanceLocationLat ?? ''}
                      className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="text-xs text-gray-700 dark:text-slate-300">
                    基準経度 (lng)
                    <input
                      type="number"
                      name="attendance_location_lng"
                      step="0.0000001"
                      min={-180}
                      max={180}
                      defaultValue={attendanceLocationLng ?? ''}
                      className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="text-xs text-gray-700 dark:text-slate-300">
                    許容半径 (m)
                    <input
                      type="number"
                      name="attendance_location_radius_meters"
                      min={1}
                      max={5000}
                      defaultValue={attendanceLocationRadiusMeters}
                      className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      disabled={!canManage}
                    />
                  </label>
                </div>
              </div>
            </div>
            <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
            <button
              type="submit"
              disabled={!canManage}
              className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              勤怠打刻設定を保存
            </button>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">会員証表示設定</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">会員証の表示と有効期限ルールを店舗ごとに設定します。</p>
          <form action="/api/stores/member-card-settings" method="post" className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                name="member_card_rank_visible"
                defaultChecked={memberCardRankVisible}
                disabled={!canManage}
              />
              会員証にランクを表示する
            </label>
            <label className="block text-sm text-gray-700 dark:text-slate-300">
              会員証TTL（日）
              <select
                name="member_portal_ttl_days"
                defaultValue={memberPortalTtlDays}
                disabled={!canManage}
                className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={30}>30日</option>
                <option value={90}>90日</option>
                <option value={180}>180日</option>
              </select>
            </label>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              失効判定は「対象店舗の最終来店日 + TTL」（来店履歴がない場合は発行日 + TTL）です。
            </p>
            <div>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                会員証設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">LTVランク初期値</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            ランク判定の基準を表で設定します。年間売上または来店回数のどちらかが基準を満たすと、そのランク候補になります。
            `0` を入力すると、その項目は判定に使いません。
          </p>
          <form action="/api/stores/ltv-rank-settings" method="post" className="space-y-4">
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-slate-700">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="border border-gray-200 px-2.5 py-2 text-left dark:border-slate-700">ランク</th>
                    <th className="border border-gray-200 px-2.5 py-2 text-left dark:border-slate-700">年間売上（円）</th>
                    <th className="border border-gray-200 px-2.5 py-2 text-left dark:border-slate-700">来店回数（回/年）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="border border-gray-200 px-2.5 py-2 text-left font-semibold text-amber-700 dark:border-slate-700">
                      ゴールド
                    </th>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_gold_annual_sales_threshold"
                        defaultValue={ltvGoldAnnualSalesThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_gold_visit_count_threshold"
                        defaultValue={ltvGoldVisitCountThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 px-2.5 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      シルバー
                    </th>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_silver_annual_sales_threshold"
                        defaultValue={ltvSilverAnnualSalesThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_silver_visit_count_threshold"
                        defaultValue={ltvSilverVisitCountThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 px-2.5 py-2 text-left font-semibold text-orange-700 dark:border-slate-700">
                      ブロンズ
                    </th>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_bronze_annual_sales_threshold"
                        defaultValue={ltvBronzeAnnualSalesThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-2.5 py-2 dark:border-slate-700">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_bronze_visit_count_threshold"
                        defaultValue={ltvBronzeVisitCountThreshold}
                        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                LTVランク初期値を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">
          顧客ペット管理表示設定
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            顧客ペット管理で表示するカルテ件数と日誌表示対象を設定します。
          </p>
          <form action="/api/stores/customer-management-settings" method="post" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-gray-700 dark:text-slate-300">
                カルテ一覧の表示件数（最新N件）
                <input
                  type="number"
                  min={5}
                  max={100}
                  name="medical_record_list_limit"
                  defaultValue={medicalRecordListLimit}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700 dark:text-slate-300">
                日誌の表示対象
                <select
                  name="journal_visibility_mode"
                  defaultValue={journalVisibilityMode}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={!canManage}
                >
                  <option value="published_only">公開済みのみ</option>
                  <option value="include_drafts">下書きを含む</option>
                </select>
              </label>
            </div>
            <input
              type="hidden"
              name="calendar_expand_out_of_range_appointments"
              value={calendarExpandOutOfRangeAppointments ? 'true' : 'false'}
            />
            <input type="hidden" name="followup_snoozed_refollow_days" value={followupSnoozedRefollowDays} />
            <input type="hidden" name="followup_no_need_refollow_days" value={followupNoNeedRefollowDays} />
            <input type="hidden" name="followup_lost_refollow_days" value={followupLostRefollowDays} />
            <div>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                顧客ペット管理表示設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-slate-100">
          再来店フォロー日数設定
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            再来店フォローのステータス別に、次回フォローまでの日数を設定します。
          </p>
          <form action="/api/stores/customer-management-settings" method="post" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-xs text-gray-700 dark:text-slate-300">
                保留の再フォロー日数
                <input
                  type="number"
                  min={1}
                  max={365}
                  name="followup_snoozed_refollow_days"
                  defaultValue={followupSnoozedRefollowDays}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700 dark:text-slate-300">
                不要の再フォロー日数
                <input
                  type="number"
                  min={1}
                  max={365}
                  name="followup_no_need_refollow_days"
                  defaultValue={followupNoNeedRefollowDays}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700 dark:text-slate-300">
                失注の再フォロー日数
                <input
                  type="number"
                  min={1}
                  max={365}
                  name="followup_lost_refollow_days"
                  defaultValue={followupLostRefollowDays}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={!canManage}
                />
              </label>
            </div>
            <input type="hidden" name="medical_record_list_limit" value={medicalRecordListLimit} />
            <input type="hidden" name="journal_visibility_mode" value={journalVisibilityMode} />
            <input
              type="hidden"
              name="calendar_expand_out_of_range_appointments"
              value={calendarExpandOutOfRangeAppointments ? 'true' : 'false'}
            />
            <div>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-blue-600 px-2.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                再来店フォロー日数設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  )
}
