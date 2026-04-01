import test from 'node:test'
import assert from 'node:assert/strict'
import { enqueueJournalLineNotificationCore } from '../src/lib/journal/notifications-core.ts'

type StubResult = {
  data: unknown
  error: { message: string } | null
}

function createSupabaseStub(params: {
  customerResult: StubResult
  existingResult: StubResult
  insertError: { message: string } | null
}) {
  let insertCalled = false

  const customerQuery = {
    eq() {
      return customerQuery
    },
    maybeSingle: async () => params.customerResult,
  }

  const existingQuery = {
    eq() {
      return existingQuery
    },
    in() {
      return existingQuery
    },
    limit: async () => params.existingResult,
  }

  return {
    getInsertCalled: () => insertCalled,
    supabase: {
      from(table: string) {
        if (table === 'customers') {
          return {
            select() {
              return customerQuery
            },
          }
        }

        if (table === 'journal_notifications') {
          return {
            select() {
              return existingQuery
            },
            insert: async () => {
              insertCalled = true
              return { error: params.insertError }
            },
          }
        }

        throw new Error(`unexpected table: ${table}`)
      },
    },
  }
}

test('enqueueJournalLineNotification returns line_id_not_found when customer has no line_id', async () => {
  const stub = createSupabaseStub({
    customerResult: {
      data: { id: 'customer-1', line_id: null },
      error: null,
    },
    existingResult: {
      data: [],
      error: null,
    },
    insertError: null,
  })

  const result = await enqueueJournalLineNotificationCore({
    supabase: stub.supabase as never,
    storeId: 'store-1',
    entryId: 'entry-1',
    customerId: 'customer-1',
  })

  assert.deepEqual(result, { queued: false, reason: 'line_id_not_found' })
  assert.equal(stub.getInsertCalled(), false)
})

test('enqueueJournalLineNotification avoids duplicate queued/sent records', async () => {
  const stub = createSupabaseStub({
    customerResult: {
      data: { id: 'customer-1', line_id: 'line-user-1' },
      error: null,
    },
    existingResult: {
      data: [{ id: 'n-1', status: 'queued' }],
      error: null,
    },
    insertError: null,
  })

  const result = await enqueueJournalLineNotificationCore({
    supabase: stub.supabase as never,
    storeId: 'store-1',
    entryId: 'entry-1',
    customerId: 'customer-1',
  })

  assert.deepEqual(result, { queued: false, reason: 'already_queued_or_sent' })
  assert.equal(stub.getInsertCalled(), false)
})

test('enqueueJournalLineNotification inserts queued row when customer has line_id and no duplicate', async () => {
  const stub = createSupabaseStub({
    customerResult: {
      data: { id: 'customer-1', line_id: 'line-user-1' },
      error: null,
    },
    existingResult: {
      data: [],
      error: null,
    },
    insertError: null,
  })

  const result = await enqueueJournalLineNotificationCore({
    supabase: stub.supabase as never,
    storeId: 'store-1',
    entryId: 'entry-1',
    customerId: 'customer-1',
  })

  assert.deepEqual(result, { queued: true })
  assert.equal(stub.getInsertCalled(), true)
})
