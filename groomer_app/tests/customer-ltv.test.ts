import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCustomerLtvRankLabel,
  getCustomerLtvRankTone,
} from '../src/lib/customer-ltv.ts'

test('getCustomerLtvRankLabel falls back to B', () => {
  assert.equal(getCustomerLtvRankLabel('S'), 'S')
  assert.equal(getCustomerLtvRankLabel('A'), 'A')
  assert.equal(getCustomerLtvRankLabel('unknown'), 'B')
})

test('getCustomerLtvRankTone returns stable badge class', () => {
  assert.equal(getCustomerLtvRankTone('S'), 'bg-amber-100 text-amber-900')
  assert.equal(getCustomerLtvRankTone('A'), 'bg-sky-100 text-sky-800')
  assert.equal(getCustomerLtvRankTone('B'), 'bg-slate-100 text-slate-700')
})
