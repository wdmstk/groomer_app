import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPaymentAppointmentLabel,
  formatPaymentDateTimeJst,
  formatPaymentPaidAt,
  formatPaymentPaidState,
} from '../src/lib/payments/presentation.ts'

test('payment presentation helpers build JST appointment labels', () => {
  const label = buildPaymentAppointmentLabel({
    id: 'appt-1',
    customerId: 'cust-1',
    startTime: '2026-03-16T01:00:00.000Z',
    customers: { full_name: '山田 花子' },
    pets: { name: 'こむぎ' },
  })

  assert.equal(label, '2026/03/16 10:00 / 山田 花子 / こむぎ')
  assert.equal(formatPaymentDateTimeJst('bad-value'), '日時未設定')
})

test('payment presentation helpers format paid status and fallback values', () => {
  assert.equal(formatPaymentPaidState('2026-03-16T02:00:00.000Z'), '会計済')
  assert.equal(formatPaymentPaidState(null), '未会計')
  assert.equal(formatPaymentPaidAt('2026-03-16T02:00:00.000Z'), '2026/03/16 11:00')
  assert.equal(formatPaymentPaidAt(null), '未払い')
})
