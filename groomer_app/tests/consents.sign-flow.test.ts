import assert from 'node:assert/strict'
import test from 'node:test'
import { signConsentWithDeps, type SignConsentDeps } from '../src/lib/consents/sign-flow.ts'

function createDeps() {
  const calls = {
    signatureUploads: 0,
    pdfUploads: 0,
    signatureInserts: 0,
    documentUpdates: 0,
    audits: 0,
    signedUrlRequests: 0,
  }

  const deps: SignConsentDeps = {
    uploadSignature: async () => {
      calls.signatureUploads += 1
    },
    getTemplateVersion: async () => ({ title: '基本同意書', version_no: 3 }),
    getCustomer: async () => ({ full_name: '山田 花子' }),
    getPet: async () => ({ name: 'こむぎ' }),
    uploadPdf: async () => {
      calls.pdfUploads += 1
    },
    insertSignature: async () => {
      calls.signatureInserts += 1
    },
    updateDocumentAsSigned: async () => {
      calls.documentUpdates += 1
    },
    insertAuditLog: async () => {
      calls.audits += 1
    },
    createSignedPdfUrl: async () => {
      calls.signedUrlRequests += 1
      return 'https://example.com/signed.pdf'
    },
  }

  return { deps, calls }
}

test('signConsentWithDeps performs signature/pdf/update/audit pipeline', async () => {
  const { deps, calls } = createDeps()
  const result = await signConsentWithDeps({
    deps,
    document: {
      id: 'doc-1',
      store_id: 'store-1',
      customer_id: 'customer-1',
      pet_id: 'pet-1',
      template_version_id: 'ver-1',
      status: 'sent',
      token_expires_at: '2026-03-27T00:00:00.000Z',
    },
    signerName: '山田 花子',
    signatureBuffer: Buffer.from('png-bytes'),
    signatureStrokes: [],
    ipHash: 'ip-hash',
    uaHash: 'ua-hash',
    deviceType: 'mobile',
    deviceOs: 'ios',
    browser: 'safari',
    nowIso: '2026-03-26T10:00:00.000Z',
  })

  assert.equal(result.documentId, 'doc-1')
  assert.equal(result.pdfPath, 'store-1/consents/pdfs/doc-1.pdf')
  assert.equal(result.signaturePath.startsWith('store-1/consents/signatures/doc-1-'), true)
  assert.equal(result.pdfUrl, 'https://example.com/signed.pdf')
  assert.equal(calls.signatureUploads, 1)
  assert.equal(calls.pdfUploads, 1)
  assert.equal(calls.signatureInserts, 1)
  assert.equal(calls.documentUpdates, 1)
  assert.equal(calls.audits, 1)
  assert.equal(calls.signedUrlRequests, 1)
})
