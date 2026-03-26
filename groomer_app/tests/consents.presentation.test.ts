import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatConsentDateTime,
  getConsentStatusLabel,
  getConsentStatusTone,
} from '../src/lib/consents/presentation.ts'

test('getConsentStatusLabel maps known statuses', () => {
  assert.equal(getConsentStatusLabel('signed'), '署名済み')
  assert.equal(getConsentStatusLabel('sent'), '送信済み')
  assert.equal(getConsentStatusLabel('revoked'), '失効')
  assert.equal(getConsentStatusLabel('expired'), '期限切れ')
  assert.equal(getConsentStatusLabel('canceled'), '取消')
  assert.equal(getConsentStatusLabel('draft'), '下書き')
  assert.equal(getConsentStatusLabel('unknown'), '下書き')
})

test('getConsentStatusTone returns utility classes', () => {
  assert.equal(getConsentStatusTone('signed'), 'bg-emerald-100 text-emerald-800')
  assert.equal(getConsentStatusTone('sent'), 'bg-indigo-100 text-indigo-800')
  assert.equal(getConsentStatusTone('unknown'), 'bg-gray-100 text-gray-700')
})

test('formatConsentDateTime returns fallback for invalid value', () => {
  assert.equal(formatConsentDateTime(null), '-')
  assert.equal(formatConsentDateTime('invalid'), '-')
})
