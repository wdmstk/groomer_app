import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  addDaysToJstDate,
  buildJstDayWindowIso,
  getJstDate,
  makeReminderDedupeKey,
  shouldSendReminderNow,
  toStoreNotificationSettings,
  type StoreNotificationSettingsRow,
} from '../src/lib/cron/services/appointment-reminders-core.ts'

test('addDaysToJstDate shifts JST date correctly', () => {
  assert.equal(addDaysToJstDate('2026-03-12', 1), '2026-03-13')
  assert.equal(addDaysToJstDate('2026-03-12', -1), '2026-03-11')
})

test('buildJstDayWindowIso returns iso range for JST day', () => {
  const window = buildJstDayWindowIso('2026-03-12')
  assert.equal(window.start, '2026-03-11T15:00:00.000Z')
  assert.equal(window.end, '2026-03-12T14:59:59.999Z')
})

test('getJstDate resolves date in JST', () => {
  assert.equal(getJstDate('2026-03-11T23:30:00.000Z'), '2026-03-12')
  assert.equal(getJstDate('invalid'), null)
})

test('toStoreNotificationSettings normalizes out-of-range values', () => {
  const row: StoreNotificationSettingsRow = {
    store_id: 'store-1',
    reminder_line_enabled: null,
    reminder_email_enabled: false,
    reminder_day_before_enabled: true,
    reminder_same_day_enabled: null,
    reminder_day_before_send_hour_jst: 30,
    reminder_same_day_send_hour_jst: -4,
  }
  const normalized = toStoreNotificationSettings(row)

  assert.equal(normalized.reminderLineEnabled, DEFAULT_NOTIFICATION_SETTINGS.reminderLineEnabled)
  assert.equal(normalized.reminderEmailEnabled, false)
  assert.equal(normalized.reminderDayBeforeEnabled, true)
  assert.equal(normalized.reminderSameDayEnabled, DEFAULT_NOTIFICATION_SETTINGS.reminderSameDayEnabled)
  assert.equal(normalized.reminderDayBeforeSendHourJst, 23)
  assert.equal(normalized.reminderSameDaySendHourJst, 0)
})

test('shouldSendReminderNow checks timing and hour', () => {
  const settings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    reminderDayBeforeSendHourJst: 18,
    reminderSameDaySendHourJst: 9,
  }
  assert.equal(
    shouldSendReminderNow({ settings, timing: 'day_before', currentHourJst: 18 }),
    true
  )
  assert.equal(
    shouldSendReminderNow({ settings, timing: 'day_before', currentHourJst: 19 }),
    false
  )
  assert.equal(
    shouldSendReminderNow({ settings, timing: 'same_day', currentHourJst: 9 }),
    true
  )
})

test('makeReminderDedupeKey includes timing and channel', () => {
  const key = makeReminderDedupeKey({
    timing: 'same_day',
    channel: 'line',
    appointmentId: 'apt-1',
    appointmentDateJst: '2026-03-12',
  })
  assert.equal(key, 'reminder:same_day:line:apt-1:2026-03-12')
})

test('makeReminderDedupeKey prefers group id when present', () => {
  const key = makeReminderDedupeKey({
    timing: 'day_before',
    channel: 'email',
    appointmentId: 'apt-1',
    groupId: 'group-1',
    appointmentDateJst: '2026-03-12',
  })
  assert.equal(key, 'reminder:day_before:email:group-1:2026-03-12')
})
