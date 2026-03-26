import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hoursSince,
  resolveConsentReminderAppBaseUrl,
  shouldSendConsentReminder,
} from '../src/lib/cron/services/consent-reminders-core.ts'

test('resolveConsentReminderAppBaseUrl prefers APP_BASE_URL and trims trailing slash', () => {
  assert.equal(
    resolveConsentReminderAppBaseUrl({
      APP_BASE_URL: 'https://app.example.com/',
      NEXT_PUBLIC_APP_URL: 'https://public.example.com',
    }),
    'https://app.example.com'
  )
})

test('resolveConsentReminderAppBaseUrl falls back to NEXT_PUBLIC_APP_URL', () => {
  assert.equal(
    resolveConsentReminderAppBaseUrl({
      NEXT_PUBLIC_APP_URL: 'https://public.example.com/',
    }),
    'https://public.example.com'
  )
})

test('hoursSince returns elapsed hours and 0 for invalid date', () => {
  const nowMs = Date.parse('2026-03-26T12:00:00.000Z')
  assert.equal(hoursSince('2026-03-25T12:00:00.000Z', nowMs), 24)
  assert.equal(hoursSince('invalid', nowMs), 0)
})

test('shouldSendConsentReminder for after_24h/after_72h', () => {
  const nowMs = Date.parse('2026-03-26T12:00:00.000Z')
  assert.equal(
    shouldSendConsentReminder({
      type: 'after_24h',
      createdAt: '2026-03-25T11:59:00.000Z',
      tokenExpiresAt: null,
      nowMs,
    }),
    true
  )
  assert.equal(
    shouldSendConsentReminder({
      type: 'after_72h',
      createdAt: '2026-03-24T12:00:00.000Z',
      tokenExpiresAt: null,
      nowMs,
    }),
    false
  )
})

test('shouldSendConsentReminder for before_expiry only when remaining <= 24h and > 0h', () => {
  const nowMs = Date.parse('2026-03-26T12:00:00.000Z')
  assert.equal(
    shouldSendConsentReminder({
      type: 'before_expiry',
      createdAt: '2026-03-25T12:00:00.000Z',
      tokenExpiresAt: '2026-03-27T11:59:00.000Z',
      nowMs,
    }),
    true
  )
  assert.equal(
    shouldSendConsentReminder({
      type: 'before_expiry',
      createdAt: '2026-03-25T12:00:00.000Z',
      tokenExpiresAt: '2026-03-28T12:00:00.000Z',
      nowMs,
    }),
    false
  )
  assert.equal(
    shouldSendConsentReminder({
      type: 'before_expiry',
      createdAt: '2026-03-25T12:00:00.000Z',
      tokenExpiresAt: '2026-03-26T11:59:00.000Z',
      nowMs,
    }),
    false
  )
})
