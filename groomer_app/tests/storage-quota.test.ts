import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStorageQuotaWarningMessage } from '../src/lib/storage-quota.ts'

test('buildStorageQuotaWarningMessage includes upstream message when available', () => {
  assert.equal(
    buildStorageQuotaWarningMessage(new Error('Bad Gateway')),
    '使用量の取得に失敗したため、暫定値を表示しています: Bad Gateway'
  )
})

test('buildStorageQuotaWarningMessage falls back to a generic message', () => {
  assert.equal(
    buildStorageQuotaWarningMessage(null),
    '使用量の取得に失敗したため、暫定値を表示しています。'
  )
})
