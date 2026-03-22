import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateInvoiceTotalAfterDiscount,
  canEditInvoiceStatus,
  normalizeRequestedInvoiceStatus,
  summarizeInvoiceLines,
} from '../src/lib/invoices/detail-core.ts'

test('canEditInvoiceStatus allows draft/open only', () => {
  assert.equal(canEditInvoiceStatus('draft'), true)
  assert.equal(canEditInvoiceStatus('open'), true)
  assert.equal(canEditInvoiceStatus('paid'), false)
  assert.equal(canEditInvoiceStatus('void'), false)
})

test('normalizeRequestedInvoiceStatus keeps only supported statuses', () => {
  assert.equal(normalizeRequestedInvoiceStatus('draft'), 'draft')
  assert.equal(normalizeRequestedInvoiceStatus('open'), 'open')
  assert.equal(normalizeRequestedInvoiceStatus('paid'), null)
  assert.equal(normalizeRequestedInvoiceStatus(null), null)
})

test('summarizeInvoiceLines aggregates line values', () => {
  const summary = summarizeInvoiceLines([
    { line_subtotal: 1000, line_tax: 100, line_total: 1100 },
    { line_subtotal: 2000, line_tax: 0, line_total: 2000 },
  ])

  assert.deepEqual(summary, {
    subtotal: 3000,
    tax: 100,
    total: 3100,
  })
})

test('calculateInvoiceTotalAfterDiscount does not go below zero', () => {
  assert.equal(calculateInvoiceTotalAfterDiscount(3000, 500), 2500)
  assert.equal(calculateInvoiceTotalAfterDiscount(3000, 4000), 0)
})
