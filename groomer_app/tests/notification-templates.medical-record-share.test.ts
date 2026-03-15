import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMedicalRecordShareLineTemplate } from '../src/lib/notification-templates.ts'

test('renderMedicalRecordShareLineTemplate fills customer, pet, and share url', () => {
  const body = renderMedicalRecordShareLineTemplate({
    customerName: '山田',
    petName: 'ココ',
    shareUrl: 'https://example.com/shared/medical-records/token-1',
  })

  assert.match(body, /山田/)
  assert.match(body, /ココ/)
  assert.match(body, /https:\/\/example\.com\/shared\/medical-records\/token-1/)
})
