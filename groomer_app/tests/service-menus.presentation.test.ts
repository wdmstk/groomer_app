import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatServiceMenuActive,
  formatServiceMenuCategory,
  formatServiceMenuInstantBookable,
  formatServiceMenuNotes,
  formatServiceMenuTaxIncluded,
  formatServiceMenuTaxRate,
} from '../src/lib/service-menus/presentation.ts'

test('service menu presentation helpers apply default labels for null values', () => {
  assert.equal(formatServiceMenuCategory(null), '未設定')
  assert.equal(formatServiceMenuTaxRate(null), 0.1)
  assert.equal(formatServiceMenuTaxIncluded(null), '税込')
  assert.equal(formatServiceMenuActive(null), '有効')
  assert.equal(formatServiceMenuInstantBookable(null), '対象外')
  assert.equal(formatServiceMenuNotes(''), 'なし')
})
