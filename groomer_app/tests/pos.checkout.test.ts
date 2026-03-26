import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePosCartTotals } from '../src/lib/pos/checkout.ts'

test('calculatePosCartTotals: tax included lines are aggregated', () => {
  const totals = calculatePosCartTotals(
    [
      {
        quantity: 2,
        unitAmount: 1100,
        taxRate: 0.1,
        taxIncluded: true,
      },
    ],
    0
  )

  assert.equal(totals.subtotal, 2000)
  assert.equal(totals.tax, 200)
  assert.equal(totals.total, 2200)
})

test('calculatePosCartTotals: tax excluded and discount clamp at zero', () => {
  const totals = calculatePosCartTotals(
    [
      {
        quantity: 1,
        unitAmount: 1000,
        taxRate: 0.1,
        taxIncluded: false,
      },
    ],
    5000
  )

  assert.equal(totals.subtotal, 1000)
  assert.equal(totals.tax, 100)
  assert.equal(totals.total, 0)
})
