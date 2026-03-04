import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculatePaymentTotals,
  validatePaymentWriteInput,
} from '../src/lib/payments/services/shared.ts'

test('calculatePaymentTotals handles tax included and excluded menus', () => {
  const totals = calculatePaymentTotals([
    {
      menu_id: 'm1',
      menu_name: 'Bath',
      price: 1100,
      duration: 30,
      tax_rate: 0.1,
      tax_included: true,
    },
    {
      menu_id: 'm2',
      menu_name: 'Cut',
      price: 2000,
      duration: 45,
      tax_rate: 0.1,
      tax_included: false,
    },
  ])

  assert.equal(Math.round(totals.subtotal), 3000)
  assert.equal(Math.round(totals.tax), 300)
  assert.equal(Math.round(totals.total), 3300)
})

test('validatePaymentWriteInput requires appointmentId', () => {
  assert.throws(
    () =>
      validatePaymentWriteInput({
        appointmentId: null,
        customerId: 'cust-1',
        method: '現金',
        discountAmount: 0,
        notes: null,
      }),
    /予約の選択は必須です/
  )
})
