import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMedicalRecordShareLineMessage,
  buildMedicalRecordShareUrl,
} from '../src/lib/medical-records/share.ts'

test('buildMedicalRecordShareUrl creates a shared medical record URL', () => {
  assert.equal(
    buildMedicalRecordShareUrl('https://example.com/api/medical-records/record-1/share', 'token-123'),
    'https://example.com/shared/medical-records/token-123'
  )
})

test('buildMedicalRecordShareLineMessage includes customer, pet, and URL', () => {
  const message = buildMedicalRecordShareLineMessage({
    customerName: '山田',
    petName: 'モカ',
    shareUrl: 'https://example.com/shared/medical-records/token-123',
  })

  assert.match(message, /山田様/)
  assert.match(message, /モカちゃん/)
  assert.match(message, /https:\/\/example\.com\/shared\/medical-records\/token-123/)
})
