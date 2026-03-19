import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCustomerLtvRankLabel,
  getCustomerLtvRankTone,
} from '../src/lib/customer-ltv.ts'

test('getCustomerLtvRankLabel falls back to スタンダード', () => {
  assert.equal(getCustomerLtvRankLabel('ゴールド'), 'ゴールド')
  assert.equal(getCustomerLtvRankLabel('シルバー'), 'シルバー')
  assert.equal(getCustomerLtvRankLabel('ブロンズ'), 'ブロンズ')
  assert.equal(getCustomerLtvRankLabel('unknown'), 'スタンダード')
})

test('getCustomerLtvRankTone returns stable badge class', () => {
  assert.equal(getCustomerLtvRankTone('ゴールド'), 'bg-amber-100 text-amber-900')
  assert.equal(getCustomerLtvRankTone('シルバー'), 'bg-slate-100 text-slate-700')
  assert.equal(getCustomerLtvRankTone('ブロンズ'), 'bg-orange-100 text-orange-900')
  assert.equal(getCustomerLtvRankTone('unknown'), 'bg-sky-100 text-sky-800')
})
