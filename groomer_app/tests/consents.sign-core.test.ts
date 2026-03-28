import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsentPdfLines,
  buildConsentPdfPath,
  buildConsentSignaturePath,
  isConsentTokenExpired,
  validateConsentSignInput,
} from '../src/lib/consents/sign-core.ts'

test('validateConsentSignInput validates signer/consent/signature fields', () => {
  assert.equal(validateConsentSignInput(null).ok, false)
  assert.equal(
    validateConsentSignInput({
      signer_name: '山田 花子',
      signature_image_base64: 'data:image/png;base64,abcd',
      consent_checked: true,
    }).ok,
    true
  )
})

test('isConsentTokenExpired detects expiration correctly', () => {
  const nowMs = Date.parse('2026-03-26T12:00:00.000Z')
  assert.equal(isConsentTokenExpired('2026-03-26T11:59:59.000Z', nowMs), true)
  assert.equal(isConsentTokenExpired('2026-03-26T12:00:01.000Z', nowMs), false)
  assert.equal(isConsentTokenExpired(null, nowMs), false)
})

test('buildConsentSignaturePath/buildConsentPdfPath build deterministic paths', () => {
  assert.equal(
    buildConsentSignaturePath({ storeId: 'store-1', documentId: 'doc-1', nowMs: 12345 }),
    'store-1/consents/signatures/doc-1-12345.png'
  )
  assert.equal(buildConsentPdfPath({ storeId: 'store-1', documentId: 'doc-1' }), 'store-1/consents/pdfs/doc-1.pdf')
})

test('buildConsentPdfLines includes required audit lines', () => {
  const lines = buildConsentPdfLines({
    documentId: 'doc-1',
    versionNo: 2,
    consentBodyText: '本文1\n本文2',
    customerName: '山田 花子',
    petName: 'こむぎ',
    signerName: '山田 花子',
    signedAt: '2026-03-26T12:00:00.000Z',
    signatureMethod: 'draw',
    signatureDigest: 'abc123',
    signaturePath: 'store-1/consents/signatures/doc-1-12345.png',
  })

  assert.equal(lines[0], '同意本文')
  assert.equal(lines[1], '本文1')
  assert.equal(lines.includes('監査情報'), true)
  assert.equal(lines.includes('Document ID: doc-1'), true)
  assert.equal(lines.includes('Version: 2'), true)
  assert.equal(lines.includes('Signature Method: draw'), true)
  assert.equal(lines.includes('Signature Digest (sha256): abc123'), true)
  assert.equal(lines.at(-1), 'Signature Path: store-1/consents/signatures/doc-1-12345.png')
})
