import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getInitialReservationPaymentState,
  getReservationPaymentBadge,
  normalizeReservationPaymentMethod,
} from '../src/lib/appointments/reservation-payment.ts'

test('normalizeReservationPaymentMethod falls back to none', () => {
  assert.equal(normalizeReservationPaymentMethod('unknown'), 'none')
  assert.equal(normalizeReservationPaymentMethod('prepayment'), 'prepayment')
})

test('getInitialReservationPaymentState returns authorized for card hold', () => {
  const state = getInitialReservationPaymentState('card_hold')
  assert.equal(state.reservationPaymentStatus, 'authorized')
  assert.equal(typeof state.reservationPaymentAuthorizedAt, 'string')
  assert.equal(state.reservationPaymentPaidAt, null)
})

test('getInitialReservationPaymentState returns unpaid for prepayment', () => {
  const state = getInitialReservationPaymentState('prepayment')
  assert.equal(state.reservationPaymentStatus, 'unpaid')
  assert.equal(state.reservationPaymentPaidAt, null)
})

test('getReservationPaymentBadge returns prepaid badge', () => {
  const badge = getReservationPaymentBadge({
    method: 'prepayment',
    status: 'paid',
  })

  assert.deepEqual(badge, {
    label: '決済済',
    className: 'bg-emerald-100 text-emerald-800',
  })
})
