import assert from 'node:assert/strict'
import test from 'node:test'
import { insertConsentAuditLog } from '../src/lib/consents/audit.ts'

test('insertConsentAuditLog inserts expected payload', async () => {
  let capturedTable = ''
  let capturedValue: unknown = null
  const fakeClient = {
    from(table: string) {
      capturedTable = table
      return {
        insert(value: unknown) {
          capturedValue = value
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  await insertConsentAuditLog({
    supabase: fakeClient,
    storeId: 'store-1',
    entityType: 'document',
    entityId: 'doc-1',
    action: 'created',
    actorUserId: 'user-1',
    before: null,
    after: { status: 'draft' },
    payload: { reason: 'test' },
  })

  assert.equal(capturedTable, 'consent_audit_logs')
  assert.deepEqual(capturedValue, {
    store_id: 'store-1',
    entity_type: 'document',
    entity_id: 'doc-1',
    action: 'created',
    actor_user_id: 'user-1',
    before: null,
    after: { status: 'draft' },
    payload: { reason: 'test' },
  })
})

test('insertConsentAuditLog throws when insert fails', async () => {
  const fakeClient = {
    from() {
      return {
        insert() {
          return Promise.resolve({ error: { message: 'insert failed' } })
        },
      }
    },
  }

  await assert.rejects(
    () =>
      insertConsentAuditLog({
        supabase: fakeClient,
        storeId: 'store-1',
        entityType: 'document',
        entityId: 'doc-1',
        action: 'created',
      }),
    /insert failed/
  )
})
