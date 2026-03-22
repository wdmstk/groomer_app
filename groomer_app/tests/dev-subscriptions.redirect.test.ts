import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDevSubscriptionsRedirectUrl } from '../src/lib/dev-subscriptions/redirect.ts'

test('buildDevSubscriptionsRedirectUrl keeps /dev/subscriptions and message query', () => {
  const url = buildDevSubscriptionsRedirectUrl(
    'https://example.com/api/dev/subscriptions/store-1',
    '更新しました。'
  )
  assert.equal(
    url.toString(),
    'https://example.com/dev/subscriptions?message=%E6%9B%B4%E6%96%B0%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F%E3%80%82'
  )
})
