import assert from 'node:assert/strict'
import test from 'node:test'
import { createConsentDocumentWithDeps, type CreateConsentDocumentDeps } from '../src/lib/consents/documents-flow.ts'

function buildDeps() {
  const calls = {
    deliveryLogs: 0,
    audits: [] as Array<{ entityType: string; action: string }>,
    lineSends: 0,
  }

  const deps: CreateConsentDocumentDeps = {
    insertDocument: async () => ({
      id: 'doc-1',
      status: 'draft',
      token_expires_at: '2026-03-27T00:00:00.000Z',
    }),
    getCustomer: async () => ({ line_id: 'line-1', full_name: '山田 花子' }),
    sendLineMessage: async () => {
      calls.lineSends += 1
      return { success: true }
    },
    insertDeliveryLog: async () => {
      calls.deliveryLogs += 1
    },
    insertAuditLog: async ({ entityType, action }) => {
      calls.audits.push({ entityType, action })
    },
  }

  return { deps, calls }
}

test('createConsentDocumentWithDeps creates draft in in_person channel without delivery', async () => {
  const { deps, calls } = buildDeps()

  const result = await createConsentDocumentWithDeps({
    deps,
    storeId: 'store-1',
    actorUserId: 'user-1',
    requestUrl: 'https://example.com/api/consents/documents',
    customerId: 'customer-1',
    petId: 'pet-1',
    templateId: 'tpl-1',
    versionId: 'ver-1',
    deliveryChannel: 'in_person',
    expiresInHours: 24,
  })

  assert.equal(result.inserted.id, 'doc-1')
  assert.equal(result.signUrl.startsWith('https://example.com/consent/sign/'), true)
  assert.equal(calls.lineSends, 0)
  assert.equal(calls.deliveryLogs, 0)
  assert.deepEqual(calls.audits, [{ entityType: 'document', action: 'created' }])
})

test('createConsentDocumentWithDeps sends line and records delivery audit', async () => {
  const { deps, calls } = buildDeps()

  await createConsentDocumentWithDeps({
    deps,
    storeId: 'store-1',
    actorUserId: 'user-1',
    requestUrl: 'https://example.com/api/consents/documents',
    customerId: 'customer-1',
    petId: 'pet-1',
    templateId: 'tpl-1',
    versionId: 'ver-1',
    deliveryChannel: 'line',
    expiresInHours: 24,
  })

  assert.equal(calls.lineSends, 1)
  assert.equal(calls.deliveryLogs, 1)
  assert.deepEqual(calls.audits, [
    { entityType: 'document', action: 'created' },
    { entityType: 'delivery', action: 'sent' },
  ])
})
