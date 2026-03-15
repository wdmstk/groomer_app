import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'

const NotificationTemplateEditor = nextDynamic(
  () => import('@/components/dashboard/NotificationTemplateEditor').then((mod) => mod.NotificationTemplateEditor),
  {
    loading: () => <p className="text-sm text-gray-500">テンプレートエディタを読み込み中...</p>,
  }
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  next_visit_line_enabled: boolean | null
  next_visit_notice_days_before: number | null
  slot_reoffer_line_enabled: boolean | null
  monthly_message_limit: number | null
  monthly_message_limit_with_option: number | null
  over_limit_behavior: 'queue' | 'block' | null
}

const DEFAULT_SETTINGS = {
  reminder_line_enabled: true,
  reminder_email_enabled: true,
  reminder_day_before_enabled: true,
  reminder_same_day_enabled: true,
  reminder_day_before_send_hour_jst: 18,
  reminder_same_day_send_hour_jst: 9,
  followup_line_enabled: true,
  followup_days: [30, 60],
  next_visit_line_enabled: true,
  next_visit_notice_days_before: 3,
  slot_reoffer_line_enabled: true,
  monthly_message_limit: 1000,
  monthly_message_limit_with_option: 3000,
  over_limit_behavior: 'queue' as const,
}

function toBool(value: boolean | null | undefined, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function toInt(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function toFollowupDays(value: number[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_SETTINGS.followup_days
  }
  const normalized = Array.from(
    new Set(
      value
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.floor(item))
        .filter((item) => item >= 1 && item <= 365)
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 6)
  return normalized.length > 0 ? normalized : DEFAULT_SETTINGS.followup_days
}

export default async function NotificationSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { supabase, storeId } = await createStoreScopedClient()
  const access = await requireStoreFeatureAccess({
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

  const { data: settingsRow } = await supabase
    .from('store_notification_settings')
    .select(
      'reminder_line_enabled, reminder_email_enabled, reminder_day_before_enabled, reminder_same_day_enabled, reminder_day_before_send_hour_jst, reminder_same_day_send_hour_jst, followup_line_enabled, followup_days, next_visit_line_enabled, next_visit_notice_days_before, slot_reoffer_line_enabled, monthly_message_limit, monthly_message_limit_with_option, over_limit_behavior'
    )
    .eq('store_id', storeId)
    .maybeSingle()

  const settings = (settingsRow ?? null) as NotificationSettingsRow | null
  const reminderLineEnabled = toBool(settings?.reminder_line_enabled, DEFAULT_SETTINGS.reminder_line_enabled)
  const reminderEmailEnabled = toBool(settings?.reminder_email_enabled, DEFAULT_SETTINGS.reminder_email_enabled)
  const reminderDayBeforeEnabled = toBool(
    settings?.reminder_day_before_enabled,
    DEFAULT_SETTINGS.reminder_day_before_enabled
  )
  const reminderSameDayEnabled = toBool(settings?.reminder_same_day_enabled, DEFAULT_SETTINGS.reminder_same_day_enabled)
  const reminderDayBeforeHour = toInt(
    settings?.reminder_day_before_send_hour_jst,
    DEFAULT_SETTINGS.reminder_day_before_send_hour_jst,
    0,
    23
  )
  const reminderSameDayHour = toInt(
    settings?.reminder_same_day_send_hour_jst,
    DEFAULT_SETTINGS.reminder_same_day_send_hour_jst,
    0,
    23
  )
  const followupLineEnabled = toBool(settings?.followup_line_enabled, DEFAULT_SETTINGS.followup_line_enabled)
  const followupDays = toFollowupDays(settings?.followup_days)
  const nextVisitLineEnabled = toBool(
    settings?.next_visit_line_enabled,
    DEFAULT_SETTINGS.next_visit_line_enabled
  )
  const nextVisitNoticeDaysBefore = toInt(
    settings?.next_visit_notice_days_before,
    DEFAULT_SETTINGS.next_visit_notice_days_before,
    0,
    30
  )
  const slotReofferLineEnabled = toBool(
    settings?.slot_reoffer_line_enabled,
    DEFAULT_SETTINGS.slot_reoffer_line_enabled
  )
  const monthlyLimit = toInt(settings?.monthly_message_limit, DEFAULT_SETTINGS.monthly_message_limit, 0, 1_000_000)
  const monthlyLimitWithOption = toInt(
    settings?.monthly_message_limit_with_option,
    DEFAULT_SETTINGS.monthly_message_limit_with_option,
    monthlyLimit,
    1_000_000
  )
  const overLimitBehavior =
    settings?.over_limit_behavior === 'block'
      ? 'block'
      : DEFAULT_SETTINGS.over_limit_behavior

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
          現在のロール: {currentRole ?? '未所属'} / 変更権限: {canManage ? 'あり（owner/admin）' : 'なし'}
        </p>
      </Card>
      <Card className="border border-slate-200 bg-slate-50">
        <p className="text-sm font-semibold text-gray-900">通知強化オプション契約</p>
        <p className="mt-1 text-xs text-gray-600">
          状態: {access.state.notificationOptionEnabled ? '有効（上限3,000通）' : '未契約（通常上限1,000通）'}
        </p>
        <Link href="/billing" className="mt-2 inline-block text-xs font-semibold text-blue-700">
          契約変更はサブスク課金ページで行う
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
              <input type="hidden" name="next_visit_line_enabled" value="false" />
              <input
                type="checkbox"
                name="next_visit_line_enabled"
                value="true"
                defaultChecked={nextVisitLineEnabled}
                disabled={!canManage}
              />
              次回来店提案LINEを有効化
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
              提案LINE送信日数前
              <input
                type="number"
                min={0}
                max={30}
                name="next_visit_notice_days_before"
                defaultValue={nextVisitNoticeDaysBefore}
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
