import { Card } from '@/components/ui/Card'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'
import { getSettingsManageLabel } from '@/lib/settings/presentation'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

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
          .select(
            'medical_record_list_limit, journal_visibility_mode, calendar_expand_out_of_range_appointments'
          )
          .eq('store_id', storeId)
          .maybeSingle()
      ).data as
        | {
            medical_record_list_limit?: number | null
            journal_visibility_mode?: string | null
            calendar_expand_out_of_range_appointments?: boolean | null
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
  const publicReserveBlockedDatesText = ((publicReserveBlockedDates ?? []) as Array<{
    date_key: string | null
  }>)
    .map((row) => row.date_key)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">店舗運用設定</h1>
        <p className="mt-1 text-sm text-gray-600">
          営業時間・休業日・会員証・LTVランク・顧客管理（β）の表示設定を管理します。
        </p>
      </div>

      {!canManage ? (
        <Card>
          <p className="text-sm text-gray-700">
            このページは閲覧のみ可能です。設定変更は owner/admin ロールで実行してください。
          </p>
        </Card>
      ) : null}

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">営業時間</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">
            予約カレンダーの表示は営業時間の前後1時間です（例: 9:00-19:00 の場合は 8:00-20:00）。
          </p>
          <form
            action="/api/stores/public-reserve-slot-settings"
            method="post"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
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
            <div className="flex items-end">
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
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                営業時間を保存
              </button>
            </div>
          </form>
          <form action="/api/stores/customer-management-settings" method="post" className="mt-4 border-t pt-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="hidden" name="calendar_expand_out_of_range_appointments" value="false" />
              <input
                type="checkbox"
                name="calendar_expand_out_of_range_appointments"
                value="true"
                defaultChecked={calendarExpandOutOfRangeAppointments}
                disabled={!canManage}
              />
              予約カレンダーで表示範囲外の予約がある場合に自動で表示範囲を広げる
            </label>
            <input type="hidden" name="medical_record_list_limit" value={medicalRecordListLimit} />
            <input type="hidden" name="journal_visibility_mode" value={journalVisibilityMode} />
            <div className="mt-3">
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                カレンダー表示設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">定休日・臨時休業</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">
            公開予約を受け付けない日付を `YYYY-MM-DD` 形式で1行ずつ入力します。
          </p>
          <form action="/api/stores/public-reserve-blocked-dates" method="post" className="space-y-3">
            <label className="text-xs text-gray-700">
              定休日・臨時休業日（JST）
              <textarea
                name="blocked_dates_jst"
                defaultValue={publicReserveBlockedDatesText}
                placeholder={'2026-03-20\n2026-03-21'}
                className="mt-1 min-h-28 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
            <button
              type="submit"
              disabled={!canManage}
              className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              定休日・臨時休業日を保存
            </button>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">会員証表示設定</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">会員証の表示と有効期限ルールを店舗ごとに設定します。</p>
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
            <label className="block text-sm text-gray-700">
              会員証TTL（日）
              <select
                name="member_portal_ttl_days"
                defaultValue={memberPortalTtlDays}
                disabled={!canManage}
                className="mt-1 w-full rounded border p-2 text-sm"
              >
                <option value={30}>30日</option>
                <option value={90}>90日</option>
                <option value={180}>180日</option>
              </select>
            </label>
            <p className="text-xs text-gray-500">
              失効判定は「対象店舗の最終来店日 + TTL」（来店履歴がない場合は発行日 + TTL）です。
            </p>
            <div>
              <input type="hidden" name="redirect_to" value="/settings?tab=store-ops" />
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
            ランク判定の基準を表で設定します。年間売上または来店回数のどちらかが基準を満たすと、そのランク候補になります。
            `0` を入力すると、その項目は判定に使いません。
          </p>
          <form action="/api/stores/ltv-rank-settings" method="post" className="space-y-4">
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="border border-gray-200 px-3 py-2 text-left">ランク</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">年間売上（円）</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">来店回数（回/年）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-amber-700">
                      ゴールド
                    </th>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_gold_annual_sales_threshold"
                        defaultValue={ltvGoldAnnualSalesThreshold}
                        className="w-full rounded border p-2 text-sm"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_gold_visit_count_threshold"
                        defaultValue={ltvGoldVisitCountThreshold}
                        className="w-full rounded border p-2 text-sm"
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-slate-700">
                      シルバー
                    </th>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_silver_annual_sales_threshold"
                        defaultValue={ltvSilverAnnualSalesThreshold}
                        className="w-full rounded border p-2 text-sm"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_silver_visit_count_threshold"
                        defaultValue={ltvSilverVisitCountThreshold}
                        className="w-full rounded border p-2 text-sm"
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-orange-700">
                      ブロンズ
                    </th>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        name="ltv_bronze_annual_sales_threshold"
                        defaultValue={ltvBronzeAnnualSalesThreshold}
                        className="w-full rounded border p-2 text-sm"
                        disabled={!canManage}
                      />
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        name="ltv_bronze_visit_count_threshold"
                        defaultValue={ltvBronzeVisitCountThreshold}
                        className="w-full rounded border p-2 text-sm"
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
                className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                LTVランク初期値を保存
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          顧客管理（β）表示設定
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            顧客管理（β）で表示するカルテ件数、日誌表示対象、予約カレンダーの範囲外予約表示を設定します。
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
