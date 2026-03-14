import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNotificationUsageCharge,
  countUniqueSentMessagesByStore,
  getPreviousMonthJstPeriod,
} from '../src/lib/cron/services/notification-usage-billing-core.ts'

test('countUniqueSentMessagesByStore dedupes by dedupe_key and falls back to id', () => {
  const result = countUniqueSentMessagesByStore([
    { store_id: 's1', id: '1', dedupe_key: 'a' },
    { store_id: 's1', id: '2', dedupe_key: 'a' },
    { store_id: 's1', id: '3', dedupe_key: null },
    { store_id: 's1', id: '4', dedupe_key: null },
    { store_id: 's2', id: '5', dedupe_key: 'x' },
  ])

  assert.equal(result.get('s1'), 3)
  assert.equal(result.get('s2'), 1)
})

test('calculateNotificationUsageCharge uses option limit when enabled', () => {
  const summary = calculateNotificationUsageCharge({
    sentCount: 3200,
    config: {
      monthlyLimit: 1000,
      monthlyLimitWithOption: 3000,
      optionEnabled: true,
    },
    unitPriceJpy: 3,
  })

  assert.equal(summary.appliedLimit, 3000)
  assert.equal(summary.billableMessages, 200)
  assert.equal(summary.amountJpy, 600)
})

test('getPreviousMonthJstPeriod resolves previous month boundaries', () => {
  const base = new Date('2026-03-12T10:00:00+09:00')
  const period = getPreviousMonthJstPeriod(base)

  assert.equal(period.monthJst, '2026-02-01')
  assert.equal(period.periodStartIso, '2026-01-31T15:00:00.000Z')
  assert.equal(period.periodEndIso, '2026-02-28T14:59:59.999Z')
})
