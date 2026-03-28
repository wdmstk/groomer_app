import assert from 'node:assert/strict'
import test from 'node:test'
import { createConsentDocumentWithDeps } from '../src/lib/consents/documents-flow.ts'
import { signConsentWithDeps } from '../src/lib/consents/sign-flow.ts'

test('consent full flow integration: create -> sign -> pdf url', async () => {
  const state = {
    documents: new Map<string, { id: string; store_id: string; status: string; token_expires_at: string }>(),
    deliveryLogs: [] as Array<{ documentId: string; status: string }>,
    audits: [] as Array<{ entityType: string; action: string }>,
    signatureUploads: [] as string[],
    pdfUploads: [] as string[],
  }

  const createResult = await createConsentDocumentWithDeps({
    deps: {
      insertDocument: async ({ payload }) => {
        const id = 'doc-integration-1'
        const row = {
          id,
          store_id: String(payload.store_id ?? 'store-1'),
          status: String(payload.status ?? 'draft'),
          token_expires_at: String(payload.token_expires_at ?? ''),
        }
        state.documents.set(id, row)
        return {
          id,
          status: row.status,
          token_expires_at: row.token_expires_at,
        }
      },
      getCustomer: async () => ({ line_id: null, full_name: '山田 花子' }),
      sendLineMessage: async () => ({ success: true }),
      insertDeliveryLog: async ({ documentId, status }) => {
        state.deliveryLogs.push({ documentId, status })
      },
      insertAuditLog: async ({ entityType, action }) => {
        state.audits.push({ entityType, action })
      },
    },
    storeId: 'store-1',
    actorUserId: 'user-1',
    requestUrl: 'https://example.com/api/consents/documents',
    customerId: 'customer-1',
    petId: 'pet-1',
    templateId: 'tpl-1',
    versionId: 'ver-1',
    deliveryChannel: 'in_person',
    expiresInHours: 48,
  })

  assert.equal(createResult.inserted.id, 'doc-integration-1')
  assert.equal(createResult.signUrl.startsWith('https://example.com/consent/sign/'), true)
  assert.deepEqual(state.audits, [{ entityType: 'document', action: 'created' }])

  const signedResult = await signConsentWithDeps({
    deps: {
      uploadSignature: async ({ path }) => {
        state.signatureUploads.push(path)
      },
      getTemplateVersion: async () => ({ title: '施術前同意書', version_no: 2, body_text: '同意文 {{customer_name}}' }),
      getCustomer: async () => ({ full_name: '山田 花子' }),
      getPet: async () => ({ name: 'こむぎ' }),
      getStore: async () => ({ name: 'テスト店舗' }),
      uploadPdf: async ({ path }) => {
        state.pdfUploads.push(path)
      },
      insertSignature: async () => {
        // no-op
      },
      updateDocumentAsSigned: async ({ documentId, signedAt, signerName, pdfPath }) => {
        const current = state.documents.get(documentId)
        assert.ok(current)
        state.documents.set(documentId, {
          ...current,
          status: 'signed',
          token_expires_at: signedAt,
        })
        assert.equal(signerName, '山田 花子')
        assert.equal(pdfPath, 'store-1/consents/pdfs/doc-integration-1.pdf')
      },
      insertAuditLog: async ({ entityType, action }) => {
        state.audits.push({ entityType, action })
      },
      createSignedPdfUrl: async () => 'https://example.com/signed/doc-integration-1.pdf',
    },
    document: {
      id: 'doc-integration-1',
      store_id: 'store-1',
      customer_id: 'customer-1',
      pet_id: 'pet-1',
      template_version_id: 'ver-1',
      status: 'draft',
      token_expires_at: createResult.inserted.token_expires_at,
    },
    signerName: '山田 花子',
    signatureBuffer: Buffer.from('png'),
    signatureStrokes: [],
    ipHash: 'ip-hash',
    uaHash: 'ua-hash',
    deviceType: 'mobile',
    deviceOs: 'ios',
    browser: 'safari',
    nowIso: '2026-03-27T01:00:00.000Z',
  })

  assert.equal(signedResult.documentId, 'doc-integration-1')
  assert.equal(signedResult.pdfPath, 'store-1/consents/pdfs/doc-integration-1.pdf')
  assert.equal(signedResult.pdfUrl, 'https://example.com/signed/doc-integration-1.pdf')
  assert.equal(state.signatureUploads.length, 1)
  assert.equal(state.pdfUploads.length, 1)
  assert.deepEqual(state.audits, [
    { entityType: 'document', action: 'created' },
    { entityType: 'document', action: 'signed' },
  ])
})
