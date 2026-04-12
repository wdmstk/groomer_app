import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'
import { getSettingsManageLabel } from '@/lib/settings/presentation'
import { buildPublicReservePath } from '@/lib/public-reservations/presentation'
import { createStoreScopedClient } from '@/lib/supabase/store'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type MembershipRole = 'owner' | 'admin' | 'staff'

export default async function PublicReserveSettingsContent() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: settingsPageFixtures.storeId }
    : await createStoreScopedClient()
  const publicReservePath = buildPublicReservePath(storeId)
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
            'public_reserve_conflict_warn_threshold_percent, public_reserve_staff_bias_warn_threshold_percent, public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes'
          )
          .eq('id', storeId)
          .maybeSingle()
      ).data

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
    Number(storeSettings?.public_reserve_business_start_hour_jst ?? 9) || 9
  const publicReserveBusinessEndHourJst =
    Number(storeSettings?.public_reserve_business_end_hour_jst ?? 19) || 19
  const publicReserveMinLeadMinutes =
    Number(storeSettings?.public_reserve_min_lead_minutes ?? 60) || 60

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">公開予約設定</h1>
        <p className="mt-1 text-sm text-gray-600">
          お客様向け予約で使う「予約受付ルール」と「アラート基準」を設定します。
        </p>
      </div>

      <Card className="border-emerald-200 bg-emerald-50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">店舗共通の新規顧客向けWEB予約URL</p>
            <p className="mt-1 text-xs text-emerald-900">
              <Link href={publicReservePath} target="_blank" rel="noreferrer" className="underline">
                {publicReservePath}
              </Link>
            </p>
          </div>
          <Link
            href={publicReservePath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            公開予約フォームを開く
          </Link>
        </div>
      </Card>

      {!canManage ? (
        <Card>
          <p className="text-sm text-gray-700">
            このページは閲覧のみ可能です。設定変更は owner/admin ロールで実行してください。
          </p>
        </Card>
      ) : null}

      <details className="rounded border border-gray-200 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">公開枠ルール</summary>
        <div className="mt-3">
          <p className="mb-3 text-xs text-gray-500">お客様に表示する予約枠のルールを設定します。</p>
          <p className="mb-3 text-xs text-gray-500">
            調整時間（前後の余裕時間）の標準値は <span className="font-semibold text-gray-700">15分</span>{' '}
            です。
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
              予約枠の間隔（分）
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
              調整時間（分）
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
              予約受付の締切（何分前まで）
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
            <input
              type="hidden"
              name="public_reserve_business_start_hour_jst"
              value={publicReserveBusinessStartHourJst}
            />
            <input
              type="hidden"
              name="public_reserve_business_end_hour_jst"
              value={publicReserveBusinessEndHourJst}
            />
            <div className="md:col-span-3 flex items-end">
              <input type="hidden" name="redirect_to" value="/settings?tab=public-reserve" />
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

        <div className="mt-6 border-t pt-4">
          <h2 className="text-sm font-semibold text-gray-900">アラート閾値</h2>
          <p className="mb-3 mt-2 text-xs text-gray-500">0〜100 の範囲で指定してください。</p>
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
              <input type="hidden" name="redirect_to" value="/settings?tab=public-reserve" />
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
    </section>
  )
}
