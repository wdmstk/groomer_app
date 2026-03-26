import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsentDocumentSeed,
  buildConsentLineMessage,
  buildConsentSignUrl,
  resolveConsentVersionId,
  validateConsentDocumentCreateInput,
} from '../src/lib/consents/documents-core.ts'

test('validateConsentDocumentCreateInput validates required fields', () => {
  assert.equal(validateConsentDocumentCreateInput(null).ok, false)
  assert.equal(
    validateConsentDocumentCreateInput({
      customer_id: 'customer-1',
      pet_id: 'pet-1',
      template_id: 'tpl-1',
      delivery_channel: 'line',
      expires_in_hours: 12,
    }).ok,
    true
  )
})

test('resolveConsentVersionId prefers requested version', () => {
  assert.equal(resolveConsentVersionId({ requestedVersionId: 'v2', currentVersionId: 'v1' }), 'v2')
  assert.equal(resolveConsentVersionId({ requestedVersionId: null, currentVersionId: 'v1' }), 'v1')
  assert.equal(resolveConsentVersionId({ requestedVersionId: null, currentVersionId: null }), null)
})

test('buildConsentDocumentSeed returns insert payload and token metadata', () => {
  const seed = buildConsentDocumentSeed({
    storeId: 'store-1',
    customerId: 'customer-1',
    petId: 'pet-1',
    templateId: 'tpl-1',
    versionId: 'ver-1',
    deliveryChannel: 'line',
    expiresInHours: 24,
    actorUserId: 'user-1',
    now: new Date('2026-03-26T00:00:00.000Z'),
  })

  assert.equal(seed.nextStatus, 'sent')
  assert.equal(typeof seed.token, 'string')
  assert.equal(seed.insertPayload.store_id, 'store-1')
  assert.equal(seed.insertPayload.template_version_id, 'ver-1')
  assert.equal(seed.insertPayload.token_expires_at, '2026-03-27T00:00:00.000Z')
})

test('buildConsentSignUrl and line message format expected output', () => {
  const signUrl = buildConsentSignUrl('https://example.com/api/consents/documents', 'token-abc')
  assert.equal(signUrl, 'https://example.com/consent/sign/token-abc')

  const message = buildConsentLineMessage({ customerName: '山田 花子', signUrl })
  assert.equal(message.includes('山田 花子様'), true)
  assert.equal(message.includes(signUrl), true)
})
