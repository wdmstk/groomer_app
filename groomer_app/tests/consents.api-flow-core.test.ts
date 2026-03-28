import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsentDocumentSeed,
  buildConsentSignUrl,
  resolveConsentVersionId,
  validateConsentDocumentCreateInput,
} from '../src/lib/consents/documents-core.ts'
import {
  buildConsentPdfLines,
  buildConsentPdfPath,
  buildConsentSignaturePath,
  isConsentTokenExpired,
  validateConsentSignInput,
} from '../src/lib/consents/sign-core.ts'

test('consent api flow core: create -> sign -> pdf artifacts', () => {
  const createParsed = validateConsentDocumentCreateInput({
    customer_id: 'customer-1',
    pet_id: 'pet-1',
    template_id: 'tpl-1',
    delivery_channel: 'in_person',
    expires_in_hours: 24,
  })
  assert.equal(createParsed.ok, true)
  if (!createParsed.ok) return

  const versionId = resolveConsentVersionId({
    requestedVersionId: createParsed.requestedVersionId,
    currentVersionId: 'ver-1',
  })
  assert.equal(versionId, 'ver-1')

  const seed = buildConsentDocumentSeed({
    storeId: 'store-1',
    customerId: createParsed.customerId,
    petId: createParsed.petId,
    templateId: createParsed.templateId,
    versionId: versionId ?? 'ver-1',
    deliveryChannel: createParsed.deliveryChannel,
    expiresInHours: createParsed.expiresInHours,
    actorUserId: 'user-1',
    now: new Date('2026-03-26T00:00:00.000Z'),
  })
  assert.equal(seed.nextStatus, 'draft')

  const signUrl = buildConsentSignUrl('https://example.com/api/consents/documents', seed.token)
  assert.equal(signUrl.startsWith('https://example.com/consent/sign/'), true)

  const signParsed = validateConsentSignInput({
    signer_name: '山田 花子',
    signature_image_base64: 'data:image/png;base64,aGVsbG8=',
    consent_checked: true,
  })
  assert.equal(signParsed.ok, true)
  if (!signParsed.ok) return

  const signaturePath = buildConsentSignaturePath({
    storeId: 'store-1',
    documentId: 'doc-1',
    nowMs: 1234567890,
  })
  const pdfPath = buildConsentPdfPath({ storeId: 'store-1', documentId: 'doc-1' })
  const lines = buildConsentPdfLines({
    documentId: 'doc-1',
    versionNo: 1,
    consentBodyText: '同意本文テスト',
    customerName: '山田 花子',
    petName: 'こむぎ',
    signerName: signParsed.signerName,
    signedAt: '2026-03-26T00:10:00.000Z',
    signatureMethod: 'draw',
    signatureDigest: 'digest',
    signaturePath,
  })

  assert.equal(signaturePath, 'store-1/consents/signatures/doc-1-1234567890.png')
  assert.equal(pdfPath, 'store-1/consents/pdfs/doc-1.pdf')
  assert.equal(lines[0], '同意本文')
  assert.equal(lines.includes('Document ID: doc-1'), true)
  assert.equal(lines.includes(`Signature Path: ${signaturePath}`), true)
  assert.equal(isConsentTokenExpired(seed.tokenExpiresAt, Date.parse('2026-03-26T12:00:00.000Z')), false)
})

test('consent api flow core: line delivery starts as sent and token can expire', () => {
  const parsed = validateConsentDocumentCreateInput({
    customer_id: 'customer-2',
    pet_id: 'pet-2',
    template_id: 'tpl-2',
    delivery_channel: 'line',
    expires_in_hours: 1,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  const seed = buildConsentDocumentSeed({
    storeId: 'store-2',
    customerId: parsed.customerId,
    petId: parsed.petId,
    templateId: parsed.templateId,
    versionId: 'ver-2',
    deliveryChannel: parsed.deliveryChannel,
    expiresInHours: parsed.expiresInHours,
    actorUserId: null,
    now: new Date('2026-03-26T00:00:00.000Z'),
  })
  assert.equal(seed.nextStatus, 'sent')
  assert.equal(isConsentTokenExpired(seed.tokenExpiresAt, Date.parse('2026-03-26T02:00:00.000Z')), true)
})
