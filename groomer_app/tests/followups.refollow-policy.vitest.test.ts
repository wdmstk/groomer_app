import { expect, test } from 'vitest'
import {
  buildBlockedCustomerIdsByRefollowPolicy,
  clampRefollowDays,
} from '../src/lib/followups/refollow-policy'

test('clampRefollowDays applies fallback and range', () => {
  expect(clampRefollowDays(null, 7)).toBe(7)
  expect(clampRefollowDays(0, 7)).toBe(1)
  expect(clampRefollowDays(999, 7)).toBe(365)
  expect(clampRefollowDays(14.4, 7)).toBe(14)
})

test('buildBlockedCustomerIdsByRefollowPolicy respects snoozed/no_need/lost cooldowns', () => {
  const now = new Date('2026-04-08T00:00:00.000Z').getTime()
  const day = 24 * 60 * 60 * 1000

  const blocked = buildBlockedCustomerIdsByRefollowPolicy(
    [
      { customer_id: 'open-1', status: 'open' },
      { customer_id: 'snoozed-future', status: 'snoozed', snoozed_until: '2026-04-10T00:00:00.000Z' },
      { customer_id: 'snoozed-past', status: 'snoozed', snoozed_until: '2026-04-01T00:00:00.000Z' },
      { customer_id: 'snoozed-no-date', status: 'snoozed', updated_at: new Date(now - 3 * day).toISOString() },
      { customer_id: 'booked', status: 'resolved_booked', resolved_at: new Date(now - 1 * day).toISOString() },
      { customer_id: 'no-need-recent', status: 'resolved_no_need', resolved_at: new Date(now - 59 * day).toISOString() },
      { customer_id: 'no-need-old', status: 'resolved_no_need', resolved_at: new Date(now - 61 * day).toISOString() },
      { customer_id: 'lost-recent', status: 'resolved_lost', resolved_at: new Date(now - 89 * day).toISOString() },
      { customer_id: 'lost-old', status: 'resolved_lost', resolved_at: new Date(now - 91 * day).toISOString() },
    ],
    now,
    {
      snoozedDays: 7,
      noNeedDays: 60,
      lostDays: 90,
    }
  )

  expect(blocked.has('open-1')).toBe(true)
  expect(blocked.has('snoozed-future')).toBe(true)
  expect(blocked.has('snoozed-past')).toBe(false)
  expect(blocked.has('snoozed-no-date')).toBe(true)
  expect(blocked.has('booked')).toBe(false)
  expect(blocked.has('no-need-recent')).toBe(true)
  expect(blocked.has('no-need-old')).toBe(false)
  expect(blocked.has('lost-recent')).toBe(true)
  expect(blocked.has('lost-old')).toBe(false)
})

// TRACE-021
test('buildBlockedCustomerIdsByRefollowPolicy unblocks exactly at cooldown boundary', () => {
  const now = new Date('2026-04-08T00:00:00.000Z').getTime()
  const day = 24 * 60 * 60 * 1000

  const blocked = buildBlockedCustomerIdsByRefollowPolicy(
    [
      {
        customer_id: 'snoozed-boundary',
        status: 'snoozed',
        updated_at: new Date(now - 7 * day).toISOString(),
      },
      {
        customer_id: 'no-need-boundary',
        status: 'resolved_no_need',
        resolved_at: new Date(now - 60 * day).toISOString(),
      },
      {
        customer_id: 'lost-boundary',
        status: 'resolved_lost',
        resolved_at: new Date(now - 90 * day).toISOString(),
      },
    ],
    now,
    {
      snoozedDays: 7,
      noNeedDays: 60,
      lostDays: 90,
    }
  )

  expect(blocked.has('snoozed-boundary')).toBe(false)
  expect(blocked.has('no-need-boundary')).toBe(false)
  expect(blocked.has('lost-boundary')).toBe(false)
})

test('buildBlockedCustomerIdsByRefollowPolicy handles timezone-offset timestamps consistently', () => {
  const now = new Date('2026-04-08T00:00:00+09:00').getTime()

  const blocked = buildBlockedCustomerIdsByRefollowPolicy(
    [
      { customer_id: 'no-need-z', status: 'resolved_no_need', resolved_at: '2026-02-06T15:00:00.000Z' },
      { customer_id: 'no-need-jst', status: 'resolved_no_need', resolved_at: '2026-02-07T00:00:00+09:00' },
      { customer_id: 'no-need-1sec-short', status: 'resolved_no_need', resolved_at: '2026-02-07T00:00:01+09:00' },
    ],
    now,
    {
      snoozedDays: 7,
      noNeedDays: 60,
      lostDays: 90,
    }
  )

  expect(blocked.has('no-need-z')).toBe(false)
  expect(blocked.has('no-need-jst')).toBe(false)
  expect(blocked.has('no-need-1sec-short')).toBe(true)
})
