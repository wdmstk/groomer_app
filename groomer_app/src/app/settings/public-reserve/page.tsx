import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { DEFAULT_RESERVATION_PAYMENT_SETTINGS } from '@/lib/appointments/reservation-payment'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MembershipRole = 'owner' | 'admin' | 'staff'

export default async function PublicReserveSettingsPage() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('store_memberships')
        .select('role')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
    : { data: null }
  const currentRole = (membership?.role as MembershipRole | undefined) ?? null
  const canManage = currentRole === 'owner' || currentRole === 'admin'

  const { data: storeSettings } = await supabase
    .from('stores')
    .select(
      'public_reserve_conflict_warn_threshold_percent, public_reserve_staff_bias_warn_threshold_percent, public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes'
    )
    .eq('id', storeId)
    .maybeSingle()

  const { data: publicReserveBlockedDates } = await supabase
    .from('store_public_reserve_blocked_dates')
    .select('date_key')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('date_key', { ascending: true })
  const { data: reservationPaymentSettingsRow } = await supabase
    .from('store_reservation_payment_settings')
    .select(
      'prepayment_enabled, card_hold_enabled, cancellation_day_before_percent, cancellation_same_day_percent, cancellation_no_show_percent, no_show_charge_mode'
    )
    .eq('store_id', storeId)
    .maybeSingle()

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
  const publicReserveBlockedDatesText = ((publicReserveBlockedDates ?? []) as Array<{
    date_key: string | null
  }>)
    .map((row) => row.date_key)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')
  const reservationPaymentSettings = {
    ...DEFAULT_RESERVATION_PAYMENT_SETTINGS,
    ...reservationPaymentSettingsRow,
  }

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
          現在のロール: {currentRole ?? '未所属'} / 変更権限: {canManage ? 'あり（owner/admin）' : 'なし'}
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
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">事前決済 / キャンセルポリシー</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">
            予約時に事前決済またはカード仮押さえを選べるようにし、無断キャンセル時の請求運用を設定します。
          </p>
          <form
            action="/api/settings/reservation-payment-settings"
            method="post"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="prepayment_enabled" value="false" />
              <input
                type="checkbox"
                name="prepayment_enabled"
                value="true"
                defaultChecked={reservationPaymentSettings.prepayment_enabled}
                disabled={!canManage}
              />
              事前決済を有効化
            </label>
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="card_hold_enabled" value="false" />
              <input
                type="checkbox"
                name="card_hold_enabled"
                value="true"
                defaultChecked={reservationPaymentSettings.card_hold_enabled}
                disabled={!canManage}
              />
              カード仮押さえを有効化
            </label>
            <label className="text-xs text-gray-700">
              無断キャンセル請求モード
              <select
                name="no_show_charge_mode"
                defaultValue={reservationPaymentSettings.no_show_charge_mode}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              >
                <option value="manual">ワンタップ請求</option>
                <option value="auto">自動請求</option>
              </select>
            </label>
            <label className="text-xs text-gray-700">
              前日キャンセル料（%）
              <input
                type="number"
                min={0}
                max={100}
                name="cancellation_day_before_percent"
                defaultValue={reservationPaymentSettings.cancellation_day_before_percent}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              当日キャンセル料（%）
              <input
                type="number"
                min={0}
                max={100}
                name="cancellation_same_day_percent"
                defaultValue={reservationPaymentSettings.cancellation_same_day_percent}
                className="mt-1 w-full rounded border p-2 text-sm"
                disabled={!canManage}
              />
            </label>
            <label className="text-xs text-gray-700">
              無断キャンセル料（%）
              <input
                type="number"
                min={0}
                max={100}
                name="cancellation_no_show_percent"
                defaultValue={reservationPaymentSettings.cancellation_no_show_percent}
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
                事前決済設定を保存
              </button>
            </div>
          </form>
        </div>
      </details>

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
    </section>
  )
}
