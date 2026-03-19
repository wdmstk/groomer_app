import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCustomerFallback,
  formatCustomerNoShowCount,
  formatCustomerTags,
  getCustomerLineStatus,
} from '../src/lib/customers/presentation.ts'

test('customer presentation helpers format LINE status and fallback labels', () => {
  assert.deepEqual(getCustomerLineStatus('line-user-123'), {
    linked: true,
    badgeLabel: '連携済み',
    detail: 'line-user-123',
  })
  assert.deepEqual(getCustomerLineStatus(null), {
    linked: false,
    badgeLabel: '未連携',
    detail: null,
  })
  assert.equal(formatCustomerFallback(''), '未登録')
})

test('customer presentation helpers format tags and no-show badge', () => {
  assert.equal(formatCustomerTags(['多頭飼い', '噛み癖']), '多頭飼い, 噛み癖')
  assert.equal(formatCustomerTags(null), 'なし')
  assert.equal(formatCustomerNoShowCount(2), '無断CXL 2件')
  assert.equal(formatCustomerNoShowCount(0), null)
})
