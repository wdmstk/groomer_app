import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canInvoiceBePaid,
  collectStayIdsFromInvoiceLines,
  extractAppointmentIdFromMetadata,
  extractStayIdFromMetadata,
  isInvoiceCustomerMismatch,
  resolveAppointmentIdFromInvoiceLines,
} from '../src/lib/invoices/pay-core.ts'

test('extractAppointmentIdFromMetadata returns appointment_id when present', () => {
  assert.equal(extractAppointmentIdFromMetadata({ appointment_id: 'appt-1' }), 'appt-1')
  assert.equal(extractAppointmentIdFromMetadata({ appointment_id: '  ' }), null)
  assert.equal(extractAppointmentIdFromMetadata(null), null)
})

test('extractStayIdFromMetadata returns stay_id when present', () => {
  assert.equal(extractStayIdFromMetadata({ stay_id: 'stay-1' }), 'stay-1')
  assert.equal(extractStayIdFromMetadata({}), null)
})

test('collectStayIdsFromInvoiceLines collects deduped stay ids', () => {
  const ids = collectStayIdsFromInvoiceLines([
    { source_type: 'hotel_stay_item', metadata: { stay_id: 'stay-1' } },
    { source_type: 'hotel_stay_item', metadata: { stay_id: 'stay-2' } },
    { source_type: 'hotel_stay_item', metadata: { stay_id: 'stay-1' } },
    { source_type: 'appointment_menu', metadata: { appointment_id: 'appt-1' } },
  ])

  assert.deepEqual(ids.sort(), ['stay-1', 'stay-2'])
})

test('resolveAppointmentIdFromInvoiceLines prefers appointment menu metadata', () => {
  const appointmentId = resolveAppointmentIdFromInvoiceLines({
    lines: [
      { source_type: 'appointment_menu', metadata: { appointment_id: 'appt-10' } },
      { source_type: 'hotel_stay_item', metadata: { stay_id: 'stay-1' } },
    ],
  })

  assert.equal(appointmentId, 'appt-10')
})

test('resolveAppointmentIdFromInvoiceLines falls back to hotel stays appointment_id', () => {
  const appointmentId = resolveAppointmentIdFromInvoiceLines({
    lines: [{ source_type: 'hotel_stay_item', metadata: { stay_id: 'stay-1' } }],
    hotelStays: [{ appointment_id: null }, { appointment_id: 'appt-from-stay' }],
  })

  assert.equal(appointmentId, 'appt-from-stay')
})

test('resolveAppointmentIdFromInvoiceLines returns null when no source can resolve', () => {
  const appointmentId = resolveAppointmentIdFromInvoiceLines({
    lines: [{ source_type: 'hotel_stay_item', metadata: {} }],
    hotelStays: [{ appointment_id: null }],
  })

  assert.equal(appointmentId, null)
})

test('canInvoiceBePaid returns reused when existing payment exists', () => {
  const result = canInvoiceBePaid({ status: 'open', existingPaymentId: 'pay-1' })
  assert.deepEqual(result, { ok: true, reused: true })
})

test('canInvoiceBePaid rejects paid/void invoices and allows open', () => {
  assert.deepEqual(canInvoiceBePaid({ status: 'paid' }), { ok: false, code: 'ALREADY_PAID' })
  assert.deepEqual(canInvoiceBePaid({ status: 'void' }), { ok: false, code: 'VOID_NOT_PAYABLE' })
  assert.deepEqual(canInvoiceBePaid({ status: 'open' }), { ok: true, reused: false })
})

test('isInvoiceCustomerMismatch detects mismatch and missing customer', () => {
  assert.equal(
    isInvoiceCustomerMismatch({
      invoiceCustomerId: 'customer-1',
      appointmentCustomerId: 'customer-2',
    }),
    true
  )
  assert.equal(
    isInvoiceCustomerMismatch({
      invoiceCustomerId: 'customer-1',
      appointmentCustomerId: null,
    }),
    true
  )
  assert.equal(
    isInvoiceCustomerMismatch({
      invoiceCustomerId: 'customer-1',
      appointmentCustomerId: 'customer-1',
    }),
    false
  )
})
