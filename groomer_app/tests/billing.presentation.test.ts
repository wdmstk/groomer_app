import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billingOperationTypeLabel,
  formatBillingDateOnlyJst,
  formatBillingDateTimeJst,
  formatBillingMonthJst,
  getBillingStatusBadgeClass,
  getBillingWebhookStatusClass,
} from '../src/lib/billing/presentation.ts'

test('billing presentation helpers format dates and labels', () => {
  assert.equal(formatBillingDateTimeJst('2026-03-16T02:00:00.000Z'), '2026/03/16 11:00')
  assert.equal(formatBillingDateOnlyJst('2026-03-16'), '2026/03/16')
  assert.equal(formatBillingMonthJst('2026-03-01'), '2026/03')
  assert.equal(billingOperationTypeLabel('storage_addon_paid'), '容量追加 決済完了')
})

test('billing presentation helpers resolve badge classes', () => {
  assert.equal(getBillingStatusBadgeClass('past_due'), 'bg-amber-100 text-amber-800')
  assert.equal(getBillingWebhookStatusClass('failed'), 'bg-red-100 text-red-700')
})
