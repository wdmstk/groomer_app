export type ReminderChannel = 'line' | 'email'
export type ReminderTiming = 'day_before' | 'same_day'

export type StoreNotificationSettingsRow = {
  store_id: string
  reminder_line_enabled: boolean | null
  reminder_email_enabled: boolean | null
  reminder_day_before_enabled: boolean | null
  reminder_same_day_enabled: boolean | null
  reminder_day_before_send_hour_jst: number | null
  reminder_same_day_send_hour_jst: number | null
}

export type StoreNotificationSettings = {
  reminderLineEnabled: boolean
  reminderEmailEnabled: boolean
  reminderDayBeforeEnabled: boolean
  reminderSameDayEnabled: boolean
  reminderDayBeforeSendHourJst: number
  reminderSameDaySendHourJst: number
}

export const DEFAULT_NOTIFICATION_SETTINGS: StoreNotificationSettings = {
  reminderLineEnabled: true,
  reminderEmailEnabled: true,
  reminderDayBeforeEnabled: true,
  reminderSameDayEnabled: true,
  reminderDayBeforeSendHourJst: 18,
  reminderSameDaySendHourJst: 9,
}

export function getJstNowParts() {
  const now = new Date()
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const hourFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  })
  return {
    todayJst: dateFormatter.format(now),
    currentHourJst: Number.parseInt(hourFormatter.format(now), 10),
  }
}

export function addDaysToJstDate(dateJst: string, days: number) {
  const [yearRaw, monthRaw, dayRaw] = dateJst.split('-')
  const year = Number.parseInt(yearRaw ?? '', 10)
  const month = Number.parseInt(monthRaw ?? '', 10)
  const day = Number.parseInt(dayRaw ?? '', 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateJst
  }
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function buildJstDayWindowIso(dateJst: string) {
  const start = new Date(`${dateJst}T00:00:00+09:00`)
  const end = new Date(`${dateJst}T23:59:59.999+09:00`)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function getJstDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function toStoreNotificationSettings(row: StoreNotificationSettingsRow | null): StoreNotificationSettings {
  if (!row) return DEFAULT_NOTIFICATION_SETTINGS
  const dayBeforeHour =
    typeof row.reminder_day_before_send_hour_jst === 'number' && Number.isFinite(row.reminder_day_before_send_hour_jst)
      ? Math.max(0, Math.min(23, Math.floor(row.reminder_day_before_send_hour_jst)))
      : DEFAULT_NOTIFICATION_SETTINGS.reminderDayBeforeSendHourJst
  const sameDayHour =
    typeof row.reminder_same_day_send_hour_jst === 'number' && Number.isFinite(row.reminder_same_day_send_hour_jst)
      ? Math.max(0, Math.min(23, Math.floor(row.reminder_same_day_send_hour_jst)))
      : DEFAULT_NOTIFICATION_SETTINGS.reminderSameDaySendHourJst

  return {
    reminderLineEnabled:
      typeof row.reminder_line_enabled === 'boolean'
        ? row.reminder_line_enabled
        : DEFAULT_NOTIFICATION_SETTINGS.reminderLineEnabled,
    reminderEmailEnabled:
      typeof row.reminder_email_enabled === 'boolean'
        ? row.reminder_email_enabled
        : DEFAULT_NOTIFICATION_SETTINGS.reminderEmailEnabled,
    reminderDayBeforeEnabled:
      typeof row.reminder_day_before_enabled === 'boolean'
        ? row.reminder_day_before_enabled
        : DEFAULT_NOTIFICATION_SETTINGS.reminderDayBeforeEnabled,
    reminderSameDayEnabled:
      typeof row.reminder_same_day_enabled === 'boolean'
        ? row.reminder_same_day_enabled
        : DEFAULT_NOTIFICATION_SETTINGS.reminderSameDayEnabled,
    reminderDayBeforeSendHourJst: dayBeforeHour,
    reminderSameDaySendHourJst: sameDayHour,
  }
}

export function shouldSendReminderNow(params: {
  settings: StoreNotificationSettings
  timing: ReminderTiming
  currentHourJst: number
}) {
  if (params.timing === 'day_before') {
    return params.settings.reminderDayBeforeEnabled && params.currentHourJst === params.settings.reminderDayBeforeSendHourJst
  }
  return params.settings.reminderSameDayEnabled && params.currentHourJst === params.settings.reminderSameDaySendHourJst
}

export function makeReminderDedupeKey(params: {
  timing: ReminderTiming
  channel: ReminderChannel
  appointmentId: string
  appointmentDateJst: string
  groupId?: string | null
}) {
  return `reminder:${params.timing}:${params.channel}:${params.groupId ?? params.appointmentId}:${params.appointmentDateJst}`
}
