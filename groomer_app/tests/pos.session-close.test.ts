import assert from 'node:assert/strict'
import test from 'node:test'
import { computePosSessionCloseSummary } from '../src/lib/pos/session-close.ts'

test('computePosSessionCloseSummary: includes cash sales and drawer events', () => {
  const summary = computePosSessionCloseSummary({
    confirmedOrders: [
      { id: 'o-1', total_amount: 3000 },
      { id: 'o-2', total_amount: 2000 },
    ],
    confirmPayments: [
      { order_id: 'o-1', method: '現金' },
      { order_id: 'o-2', method: 'カード' },
    ],
    drawerEvents: [
      { event_type: 'cash_in', amount: 1000 },
      { event_type: 'cash_out', amount: 500 },
      { event_type: 'adjustment', amount: 200 },
    ],
    cashCountedAmount: 4200,
  })

  assert.equal(summary.sales_total, 5000)
  assert.equal(summary.cash_sales, 3000)
  assert.equal(summary.cash_expected, 3700)
  assert.equal(summary.cash_diff, 500)
})
