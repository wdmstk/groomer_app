import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTaxLine,
  parseDiscountAmount,
  parseOptionalString,
  parseStringArray,
  toUnknownObject,
} from '../src/lib/invoices/utils.ts'

test('parseOptionalString trims and returns null for empty values', () => {
  assert.equal(parseOptionalString('  hello  '), 'hello')
  assert.equal(parseOptionalString('   '), null)
  assert.equal(parseOptionalString(10), null)
  assert.equal(parseOptionalString(null), null)
})

test('parseStringArray normalizes only string values', () => {
  const result = parseStringArray([' a ', 'b', '', 1, null])
  assert.deepEqual(result, ['a', 'b'])
})

test('parseDiscountAmount parses number and string input', () => {
  assert.equal(parseDiscountAmount(123.7), 124)
  assert.equal(parseDiscountAmount('250'), 250)
  assert.equal(parseDiscountAmount('-12'), 0)
  assert.equal(parseDiscountAmount('abc'), 0)
})

test('toUnknownObject returns object only for plain object values', () => {
  assert.deepEqual(toUnknownObject({ key: 'value' }), { key: 'value' })
  assert.equal(toUnknownObject(null), null)
  assert.equal(toUnknownObject(['a']), null)
  assert.equal(toUnknownObject('x'), null)
})

test('calculateTaxLine handles tax included values', () => {
  const result = calculateTaxLine({
    quantity: 1,
    unitAmount: 1100,
    taxRate: 0.1,
    taxIncluded: true,
  })

  assert.equal(result.lineSubtotal, 1000)
  assert.equal(result.lineTax, 100)
  assert.equal(result.lineTotal, 1100)
})

test('calculateTaxLine handles tax excluded values', () => {
  const result = calculateTaxLine({
    quantity: 2,
    unitAmount: 1000,
    taxRate: 0.1,
    taxIncluded: false,
  })

  assert.equal(result.lineSubtotal, 2000)
  assert.equal(result.lineTax, 200)
  assert.equal(result.lineTotal, 2200)
})
