export const DEFAULT_NOTIFICATION_SETTINGS = {
  reminder_line_enabled: true,
  reminder_email_enabled: true,
  reminder_day_before_enabled: true,
  reminder_same_day_enabled: true,
  reminder_day_before_send_hour_jst: 18,
  reminder_same_day_send_hour_jst: 9,
  followup_line_enabled: true,
  followup_days: [30, 60],
  slot_reoffer_line_enabled: true,
  monthly_message_limit: 1000,
  monthly_message_limit_with_option: 3000,
  over_limit_behavior: 'queue' as const,
}

export function getSettingsManageLabel(currentRole: string | null | undefined) {
  const canManage = currentRole === 'owner' || currentRole === 'admin'
  return {
    currentRole: currentRole ?? '未所属',
    canManage,
    label: canManage ? 'あり（owner/admin）' : 'なし',
  }
}

export function toSettingsBool(value: boolean | null | undefined, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function toSettingsInt(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

export function toSettingsFollowupDays(value: number[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_NOTIFICATION_SETTINGS.followup_days
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
  return normalized.length > 0 ? normalized : DEFAULT_NOTIFICATION_SETTINGS.followup_days
}
