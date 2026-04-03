import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'
import { getSettingsManageLabel } from '@/lib/settings/presentation'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type MembershipRole = 'owner' | 'admin' | 'staff'

export default async function PublicReserveSettingsPage() {
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
            'public_reserve_conflict_warn_threshold_percent, public_reserve_staff_bias_warn_threshold_percent, public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes, member_card_rank_visible, ltv_gold_annual_sales_threshold, ltv_silver_annual_sales_threshold, ltv_bronze_annual_sales_threshold, ltv_gold_visit_count_threshold, ltv_silver_visit_count_threshold, ltv_bronze_visit_count_threshold'
          )
          .eq('id', storeId)
          .maybeSingle()
      ).data

  const publicReserveBlockedDates = isPlaywrightE2E
    ? settingsPageFixtures.blockedDates
    : (
        await db
          .from('store_public_reserve_blocked_dates')
          .select('date_key')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('date_key', { ascending: true })
      ).data
  const customerManagementSettings = isPlaywrightE2E
    ? settingsPageFixtures.customerManagementSettings
    : (
        await db
          .from('store_customer_management_settings' as never)
          .select('medical_record_list_limit, journal_visibility_mode')
          .eq('store_id', storeId)
          .maybeSingle()
      ).data as { medical_record_list_limit?: number | null; journal_visibility_mode?: string | null } | null

  const publicConflictWarnThreshold =
    Number(storeSettings?.public_reserve_conflict_warn_threshold_percent ?? 10) || 10
  const publicStaffBiasWarnThreshold =
    Number(storeSettings?.public_reserve_staff_bias_warn_threshold_percent ?? 70) || 70
  const publicReserveSlotDays = Number(storeSettings?.public_reserve_slot_days ?? 7) || 7
  const publicReserveSlotIntervalMinutes =
    Number(storeSettings?.public_reserve_slot_interval_minutes ?? 30) || 30
  const publicReserveSlotBufferMinutes =
    Number(storeSettings?.public_reserve_slot_buffer_minutes ?? 15) || 15
  const publicReserveBusinessStartHourJst =
    Number(storeSettings?.public_reserve_business_start_hour_jst ?? 10) || 10
  const publicReserveBusinessEndHourJst =
    Number(storeSettings?.public_reserve_business_end_hour_jst ?? 18) || 18
  const publicReserveMinLeadMinutes =
    Number(storeSettings?.public_reserve_min_lead_minutes ?? 60) || 60
  const memberCardRankVisible = storeSettings?.member_card_rank_visible !== false
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
  const publicReserveBlockedDatesText = ((publicReserveBlockedDates ?? []) as Array<{
    date_key: string | null
  }>)
    .map((row) => row.date_key)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">公開予約設定</h1>
          <p className="mt-1 text-sm text-gray-600">
            アラート閾値・公開枠ルール・例外日を、店舗ごとに設定します。
          </p>
        </div>
        <Link href="/dashboard?tab=reoffers" className="text-sm font-semibold text-blue-700">
          空き枠再販タブへ戻る
        </Link>
      </div>

      <Card className="border border-slate-200 bg-slate-50">
        <p className="text-sm font-semibold text-gray-900">権限</p>
        <p className="mt-1 text-xs text-gray-600">
          現在のロール: {resolvedManageState.currentRole} / 変更権限: {resolvedManageState.label}
        </p>
      </Card>

      {!canManage ? (
        <Card>
          <p className="text-sm text-gray-700">
            このページは閲覧のみ可能です。設定変更は owner/admin ロールで実行してください。
          </p>
        </Card>
      ) : null}

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">アラート閾値</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">0〜100 の範囲で指定してください。</p>
          <form action="/api/stores/kpi-thresholds" method="post" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-gray-700">
              競合失敗率 警告閾値（%）
              <input
                type="number"
                min={0}
                max={100}
                name="public_reserve_conflict_warn_threshold_percent"
                defaultValue={publicConflictWarnThreshold}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              スタッフ偏り率 警告閾値（%）
              <input
                type="number"
                min={0}
                max={100}
                name="public_reserve_staff_bias_warn_threshold_percent"
                defaultValue={publicStaffBiasWarnThreshold}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <div className="flex items-end">
              <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                閾値を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">公開枠ルール</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">空き枠計算に使う基本ルールを店舗単位で設定します。</p>
          <p className="mb-3 text-xs text-gray-500">
            バッファの標準値は <span className="font-semibold text-gray-700">前後15分</span> です。
          </p>
          <form
            action="/api/stores/public-reserve-slot-settings"
            method="post"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <label className="text-xs text-gray-700">
              公開日数
              <input
                type="number"
                min={1}
                max={7}
                name="public_reserve_slot_days"
                defaultValue={publicReserveSlotDays}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              枠刻み（分）
              <input
                type="number"
                min={30}
                max={30}
                name="public_reserve_slot_interval_minutes"
                defaultValue={publicReserveSlotIntervalMinutes}
                className="mt-1 w-full rounded border p-2 text-sm"
                readOnly
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              バッファ（分）
              <input
                type="number"
                min={0}
                max={60}
                name="public_reserve_slot_buffer_minutes"
                defaultValue={publicReserveSlotBufferMinutes}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              営業開始時刻（JST 時）
              <input
                type="number"
                min={0}
                max={23}
                name="public_reserve_business_start_hour_jst"
                defaultValue={publicReserveBusinessStartHourJst}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              営業終了時刻（JST 時）
              <input
                type="number"
                min={1}
                max={24}
                name="public_reserve_business_end_hour_jst"
                defaultValue={publicReserveBusinessEndHourJst}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              最小リード時間（分）
              <input
                type="number"
                min={60}
                max={1440}
                name="public_reserve_min_lead_minutes"
                defaultValue={publicReserveMinLeadMinutes}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <div className="md:col-span-3 flex items-end">
              <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                公開枠ルールを保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          例外日（繁忙日・臨時休業）
        </summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">
            公開予約で除外したい日付を `YYYY-MM-DD` 形式で1行ずつ入力します。
          </p>
          <form action="/api/stores/public-reserve-blocked-dates" method="post" className="space-y-3">
            <label className="text-xs text-gray-700">
              除外日（JST）
              <textarea
                name="blocked_dates_jst"
                defaultValue={publicReserveBlockedDatesText}
                placeholder={'2026-03-20\n2026-03-21'}
                className="mt-1 min-h-28 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
            <button
              type="submit"
              disabled={!canManage}
              className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              例外日を保存
            </button>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">会員証表示設定</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">会員証にランク表示を出すか、店舗ごとに切り替えます。</p>
          <form action="/api/stores/member-card-settings" method="post" className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="member_card_rank_visible"
                defaultChecked={memberCardRankVisible}
                disabled={!canManage}
              />
              会員証にランクを表示する
            </label>
            <div>
              <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                会員証設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">LTVランク初期値</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            会員ランク判定の店舗別しきい値です。ゴールド以上の順で入力してください。各ランクで `0` を入れた軸は不問になります。
          </p>
          <form action="/api/stores/ltv-rank-settings" method="post" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-xs text-gray-700">
                ゴールド 年間売上（円）
                <input
                  type="number"
                  min={0}
                  step={1000}
                  name="ltv_gold_annual_sales_threshold"
                  defaultValue={ltvGoldAnnualSalesThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700">
                シルバー 年間売上（円）
                <input
                  type="number"
                  min={0}
                  step={1000}
                  name="ltv_silver_annual_sales_threshold"
                  defaultValue={ltvSilverAnnualSalesThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700">
                ブロンズ 年間売上（円）
                <input
                  type="number"
                  min={0}
                  step={1000}
                  name="ltv_bronze_annual_sales_threshold"
                  defaultValue={ltvBronzeAnnualSalesThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-xs text-gray-700">
                ゴールド 来店回数（回/年）
                <input
                  type="number"
                  min={0}
                  max={365}
                  name="ltv_gold_visit_count_threshold"
                  defaultValue={ltvGoldVisitCountThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700">
                シルバー 来店回数（回/年）
                <input
                  type="number"
                  min={0}
                  max={365}
                  name="ltv_silver_visit_count_threshold"
                  defaultValue={ltvSilverVisitCountThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700">
                ブロンズ 来店回数（回/年）
                <input
                  type="number"
                  min={0}
                  max={365}
                  name="ltv_bronze_visit_count_threshold"
                  defaultValue={ltvBronzeVisitCountThreshold}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
            </div>
            <div>
              <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                LTVランク初期値を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">顧客管理（β）表示設定</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            顧客管理（β）で表示するカルテ件数と、日誌の表示対象を店舗単位で設定します。
          </p>
          <form action="/api/stores/customer-management-settings" method="post" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-gray-700">
                カルテ一覧の表示件数（最新N件）
                <input
                  type="number"
                  min={5}
                  max={100}
                  name="medical_record_list_limit"
                  defaultValue={medicalRecordListLimit}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-gray-700">
                日誌の表示対象
                <select
                  name="journal_visibility_mode"
                  defaultValue={journalVisibilityMode}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  disabled={!canManage}
                >
                  <option value="published_only">公開済みのみ</option>
                  <option value="include_drafts">下書きを含む</option>
                </select>
              </label>
            </div>
            <div>
              <input type="hidden" name="redirect_to" value="/settings/public-reserve" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                顧客管理（β）表示設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  )
}
