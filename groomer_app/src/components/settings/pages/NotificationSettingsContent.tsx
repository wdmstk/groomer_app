import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { NotificationTemplateEditor } from '@/components/dashboard/NotificationTemplateEditor'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getSettingsManageLabel,
  toSettingsBool,
  toSettingsFollowupDays,
  toSettingsInt,
} from '@/lib/settings/presentation'
import { settingsPageFixtures } from '@/lib/e2e/settings-page-fixtures'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type MembershipRole = 'owner' | 'admin' | 'staff'

type PageProps = {
  searchParams?: Promise<{
    saved?: string
    error?: string
  }>
}

type NotificationSettingsRow = {
  reminder_line_enabled: boolean | null
  reminder_email_enabled: boolean | null
  reminder_day_before_enabled: boolean | null
  reminder_same_day_enabled: boolean | null
  reminder_day_before_send_hour_jst: number | null
  reminder_same_day_send_hour_jst: number | null
  followup_line_enabled: boolean | null
  followup_days: number[] | null
  slot_reoffer_line_enabled: boolean | null
  monthly_message_limit: number | null
  monthly_message_limit_with_option: number | null
  over_limit_behavior: 'queue' | 'block' | null
}

export default async function NotificationSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: settingsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const access = isPlaywrightE2E
    ? settingsPageFixtures.notificationAccess
    : await requireStoreFeatureAccess({
        supabase,
        storeId,
        minimumPlan: 'standard',
      })
  if (!access.ok) {
    return (
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">通知設定</h1>
          </div>
        </div>
        <Card>
          <p className="text-sm text-amber-700">{access.message}</p>
        </Card>
      </section>
    )
  }
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

  const settingsRow = isPlaywrightE2E
    ? settingsPageFixtures.notificationSettings
    : (
        await db
          .from('store_notification_settings')
          .select(
            'reminder_line_enabled, reminder_email_enabled, reminder_day_before_enabled, reminder_same_day_enabled, reminder_day_before_send_hour_jst, reminder_same_day_send_hour_jst, followup_line_enabled, followup_days, slot_reoffer_line_enabled, monthly_message_limit, monthly_message_limit_with_option, over_limit_behavior'
          )
          .eq('store_id', storeId)
          .maybeSingle()
      ).data

  const settings = (settingsRow ?? null) as NotificationSettingsRow | null
  const reminderLineEnabled = toSettingsBool(settings?.reminder_line_enabled, DEFAULT_NOTIFICATION_SETTINGS.reminder_line_enabled)
  const reminderEmailEnabled = toSettingsBool(settings?.reminder_email_enabled, DEFAULT_NOTIFICATION_SETTINGS.reminder_email_enabled)
  const reminderDayBeforeEnabled = toSettingsBool(
    settings?.reminder_day_before_enabled,
    DEFAULT_NOTIFICATION_SETTINGS.reminder_day_before_enabled
  )
  const reminderSameDayEnabled = toSettingsBool(settings?.reminder_same_day_enabled, DEFAULT_NOTIFICATION_SETTINGS.reminder_same_day_enabled)
  const reminderDayBeforeHour = toSettingsInt(
    settings?.reminder_day_before_send_hour_jst,
    DEFAULT_NOTIFICATION_SETTINGS.reminder_day_before_send_hour_jst,
    0,
    23
  )
  const reminderSameDayHour = toSettingsInt(
    settings?.reminder_same_day_send_hour_jst,
    DEFAULT_NOTIFICATION_SETTINGS.reminder_same_day_send_hour_jst,
    0,
    23
  )
  const followupLineEnabled = toSettingsBool(settings?.followup_line_enabled, DEFAULT_NOTIFICATION_SETTINGS.followup_line_enabled)
  const followupDays = toSettingsFollowupDays(settings?.followup_days)
  const slotReofferLineEnabled = toSettingsBool(
    settings?.slot_reoffer_line_enabled,
    DEFAULT_NOTIFICATION_SETTINGS.slot_reoffer_line_enabled
  )
  const monthlyLimit = toSettingsInt(settings?.monthly_message_limit, DEFAULT_NOTIFICATION_SETTINGS.monthly_message_limit, 0, 1_000_000)
  const monthlyLimitWithOption = toSettingsInt(
    settings?.monthly_message_limit_with_option,
    DEFAULT_NOTIFICATION_SETTINGS.monthly_message_limit_with_option,
    monthlyLimit,
    1_000_000
  )
  const overLimitBehavior =
    settings?.over_limit_behavior === 'block'
      ? 'block'
      : DEFAULT_NOTIFICATION_SETTINGS.over_limit_behavior

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">通知設定</h1>
          <p className="mt-1 text-sm text-gray-600">
            リマインド送信条件と通知テンプレートを店舗単位で管理します。
          </p>
        </div>
        <Link href="/dashboard?tab=reoffers" className="text-sm font-semibold text-blue-700">
          ダッシュボードへ戻る
        </Link>
      </div>

      <Card className="border border-slate-200 bg-slate-50">
        <p className="text-sm font-semibold text-gray-900">権限</p>
        <p className="mt-1 text-xs text-gray-600">
          現在のロール: {resolvedManageState.currentRole} / 変更権限: {resolvedManageState.label}
        </p>
      </Card>
      <Card className="border border-slate-200 bg-slate-50">
        <p className="text-sm font-semibold text-gray-900">通知強化オプション契約</p>
        <p className="mt-1 text-xs text-gray-600">
          状態: {access.state.notificationOptionEnabled ? '有効（上限3,000通）' : '未契約（通常上限1,000通）'}
        </p>
        <Link href="/billing" className="mt-2 inline-block text-xs font-semibold text-blue-700">
          契約変更は決済管理ページで行う
        </Link>
      </Card>

      {params?.saved === '1' ? (
        <Card className="border border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-700">通知設定を保存しました。</p>
        </Card>
      ) : null}
      {params?.error ? (
        <Card className="border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{params.error}</p>
        </Card>
      ) : null}

      {!canManage ? (
        <Card>
          <p className="text-sm text-gray-700">
            このページは閲覧のみ可能です。設定変更は owner/admin ロールで実行してください。
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">送信ルール</h2>
          <p className="text-xs text-gray-500">
            前日/当日リマインドの時刻、チャネル有効化、月次上限を設定します。
          </p>
        </div>
        <form action="/api/settings/notification-settings" method="post" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="reminder_line_enabled" value="false" />
              <input
                type="checkbox"
                name="reminder_line_enabled"
                value="true"
                defaultChecked={reminderLineEnabled}
                disabled={!canManage}
              />
              LINEリマインドを有効化
            </label>
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="reminder_email_enabled" value="false" />
              <input
                type="checkbox"
                name="reminder_email_enabled"
                value="true"
                defaultChecked={reminderEmailEnabled}
                disabled={!canManage}
              />
              メールリマインドを有効化
            </label>
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="reminder_day_before_enabled" value="false" />
              <input
                type="checkbox"
                name="reminder_day_before_enabled"
                value="true"
                defaultChecked={reminderDayBeforeEnabled}
                disabled={!canManage}
              />
              前日リマインドを有効化
            </label>
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="reminder_same_day_enabled" value="false" />
              <input
                type="checkbox"
                name="reminder_same_day_enabled"
                value="true"
                defaultChecked={reminderSameDayEnabled}
                disabled={!canManage}
              />
              当日リマインドを有効化
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-gray-700">
              前日リマインド送信時刻（JST 時）
              <input
                type="number"
                min={0}
                max={23}
                name="reminder_day_before_send_hour_jst"
                defaultValue={reminderDayBeforeHour}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                disabled={!canManage}
              />
            </label>
            <label className="text-sm text-gray-700">
              当日リマインド送信時刻（JST 時）
              <input
                type="number"
                min={0}
                max={23}
                name="reminder_same_day_send_hour_jst"
                defaultValue={reminderSameDayHour}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                disabled={!canManage}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="followup_line_enabled" value="false" />
              <input
                type="checkbox"
                name="followup_line_enabled"
                value="true"
                defaultChecked={followupLineEnabled}
                disabled={!canManage}
              />
              再来店フォローLINEを有効化
            </label>
            <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
              <input type="hidden" name="slot_reoffer_line_enabled" value="false" />
              <input
                type="checkbox"
                name="slot_reoffer_line_enabled"
                value="true"
                defaultChecked={slotReofferLineEnabled}
                disabled={!canManage}
              />
              キャンセル枠通知LINEを有効化
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-gray-700 md:col-span-1">
              再来促進日数（カンマ区切り）
              <input
                type="text"
                name="followup_days"
                defaultValue={followupDays.join(',')}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                disabled={!canManage}
              />
            </label>
            <label className="text-sm text-gray-700 md:col-span-1">
              月次上限（通常）
              <input
                type="number"
                min={0}
                max={1000000}
                name="monthly_message_limit"
                defaultValue={monthlyLimit}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                disabled={!canManage}
              />
            </label>
            <label className="text-sm text-gray-700 md:col-span-1">
              月次上限（オプション契約時）
              <input
                type="number"
                min={0}
                max={1000000}
                name="monthly_message_limit_with_option"
                defaultValue={monthlyLimitWithOption}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                disabled={!canManage}
              />
            </label>
          </div>

          <label className="text-sm text-gray-700">
            上限超過時の挙動
            <select
              name="over_limit_behavior"
              defaultValue={overLimitBehavior}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 md:max-w-sm"
              disabled={!canManage}
            >
              <option value="queue">queue（送信せずキュー保持）</option>
              <option value="block">block（送信を拒否）</option>
            </select>
          </label>

          <input type="hidden" name="redirect_to" value="/settings/notifications" />
          <button
            type="submit"
            disabled={!canManage}
            className="inline-flex items-center rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            通知設定を保存
          </button>
        </form>
      </Card>

      <Card>
        <NotificationTemplateEditor />
      </Card>
    </section>
  )
}
