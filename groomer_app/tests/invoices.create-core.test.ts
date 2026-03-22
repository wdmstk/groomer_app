import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAppointmentMenuLineDraft,
  buildHotelStayItemLineDraft,
  hasCustomerMismatch,
  sumInvoice,
  validateInvoiceCreateInput,
} from '../src/lib/invoices/create-core.ts'

test('validateInvoiceCreateInput validates required fields', () => {
  assert.equal(validateInvoiceCreateInput({ customerId: null, appointmentIds: [], hotelStayIds: [] }), 'customer_id is required.')
  assert.equal(
    validateInvoiceCreateInput({ customerId: 'customer-1', appointmentIds: [], hotelStayIds: [] }),
    'appointment_ids or hotel_stay_ids is required.'
  )
  assert.equal(
    validateInvoiceCreateInput({ customerId: 'customer-1', appointmentIds: ['appt-1'], hotelStayIds: [] }),
    null
  )
})

test('hasCustomerMismatch detects mismatch correctly', () => {
  assert.equal(hasCustomerMismatch(['customer-1', 'customer-1'], 'customer-1'), false)
  assert.equal(hasCustomerMismatch(['customer-1', 'customer-2'], 'customer-1'), true)
  assert.equal(hasCustomerMismatch(['customer-1', null], 'customer-1'), true)
})

test('buildAppointmentMenuLineDraft builds tax included line', () => {
  const line = buildAppointmentMenuLineDraft({
    id: 'am-1',
    appointment_id: 'appt-1',
    menu_id: 'menu-1',
    menu_name: 'シャンプー',
    price: 1100,
    tax_rate: 0.1,
    tax_included: true,
  })

  assert.equal(line.source_type, 'appointment_menu')
  assert.equal(line.line_subtotal, 1000)
  assert.equal(line.line_tax, 100)
  assert.equal(line.line_total, 1100)
  assert.equal(line.metadata.appointment_id, 'appt-1')
})

test('buildHotelStayItemLineDraft builds hotel line with expected fields', () => {
  const line = buildHotelStayItemLineDraft({
    id: 'hs-1',
    stay_id: 'stay-1',
    label_snapshot: 'ホテル宿泊',
    quantity: 2,
    unit_price_snapshot: 3000,
    line_amount_jpy: 6000,
    tax_rate_snapshot: 0.1,
    tax_included_snapshot: true,
  })

  assert.equal(line.source_type, 'hotel_stay_item')
  assert.equal(line.quantity, 2)
  assert.equal(line.line_total, 6000)
  assert.equal(line.metadata.stay_id, 'stay-1')
})

test('sumInvoice aggregates subtotal/tax/total', () => {
  const totals = sumInvoice([
    {
      source_type: 'appointment_menu',
      source_id: 'am-1',
      label: 'A',
      quantity: 1,
      unit_amount: 1000,
      tax_rate: 0.1,
      tax_included: true,
      line_subtotal: 910,
      line_tax: 90,
      line_total: 1000,
      sort_order: 100,
      metadata: {},
    },
    {
      source_type: 'hotel_stay_item',
      source_id: 'hs-1',
      label: 'B',
      quantity: 1,
      unit_amount: 2000,
      tax_rate: 0.1,
      tax_included: true,
      line_subtotal: 2000,
      line_tax: 0,
      line_total: 2000,
      sort_order: 200,
      metadata: {},
    },
  ])

  assert.deepEqual(totals, { subtotal: 2910, tax: 90, total: 3000 })
})
