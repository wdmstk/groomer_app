import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureAppointmentHasNoOtherPayment,
  findPaymentByAppointment,
  findPaymentByIdempotencyKey,
  findVisitByAppointment,
  isDuplicatePaymentError,
} from '../src/lib/payments/services/shared.ts'

function createPaymentsQuery(result: { data: Array<{ id: string }> | null; error: { message: string } | null }) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    neq() {
      return this
    },
    limit() {
      return Promise.resolve(result)
    },
  }
}

test('ensureAppointmentHasNoOtherPayment allows appointments without existing payments', async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, 'payments')
      return createPaymentsQuery({ data: [], error: null })
    },
  }

  await assert.doesNotReject(() =>
    ensureAppointmentHasNoOtherPayment(supabase as never, 'store-1', 'appt-1')
  )
})

test('ensureAppointmentHasNoOtherPayment rejects duplicate payments for the same appointment', async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, 'payments')
      return createPaymentsQuery({ data: [{ id: 'payment-1' }], error: null })
    },
  }

  await assert.rejects(
    () => ensureAppointmentHasNoOtherPayment(supabase as never, 'store-1', 'appt-1'),
    /二重会計はできません/
  )
})

test('isDuplicatePaymentError detects unique constraint violations', () => {
  assert.equal(
    isDuplicatePaymentError({ code: '23505', message: 'duplicate key value violates unique constraint' }),
    true
  )
  assert.equal(isDuplicatePaymentError({ code: '40001', message: 'serialization failure' }), false)
})

test('findPaymentByAppointment returns the existing payment row', async () => {
  const payment = { id: 'payment-1', appointment_id: 'appt-1' }
  const supabase = {
    from(table: string) {
      assert.equal(table, 'payments')
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: payment, error: null })
        },
      }
    },
  }

  const result = await findPaymentByAppointment(supabase as never, 'store-1', 'appt-1')
  assert.equal(result?.id, payment.id)
})

test('findPaymentByIdempotencyKey returns the existing payment row', async () => {
  const payment = { id: 'payment-1', idempotency_key: 'idem-1' }
  const supabase = {
    from(table: string) {
      assert.equal(table, 'payments')
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: payment, error: null })
        },
      }
    },
  }

  const result = await findPaymentByIdempotencyKey(supabase as never, 'store-1', 'idem-1')
  assert.equal(result?.id, payment.id)
})

test('findVisitByAppointment returns the existing visit row', async () => {
  const visit = { id: 'visit-1' }
  const supabase = {
    from(table: string) {
      assert.equal(table, 'visits')
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: visit, error: null })
        },
      }
    },
  }

  const result = await findVisitByAppointment(supabase as never, 'store-1', 'appt-1')
  assert.equal(result?.id, visit.id)
})
