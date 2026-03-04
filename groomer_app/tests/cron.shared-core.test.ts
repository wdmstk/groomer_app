import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CronSharedCoreError,
  finishJobRunCore,
  startJobRunCore,
} from '../src/lib/cron/shared-core.ts'

test('startJobRunCore acquires lock and inserts job run', async () => {
  const calls: string[] = []

  const result = await startJobRunCore({
    jobName: 'billing-status-sync',
    jobRunId: 'job-run-1',
    trigger: 'scheduled',
    requestedByUserId: null,
    sourceJobRunId: null,
    meta: { trigger: 'scheduled' },
    lockExpiresAtIso: '2026-03-01T00:15:00.000Z',
    async acquireLock() {
      calls.push('acquire')
      return true
    },
    async insertJobRun() {
      calls.push('insert')
      return true
    },
    async releaseLock() {
      calls.push('release')
    },
  })

  assert.equal(result, 'job-run-1')
  assert.deepEqual(calls, ['acquire', 'insert'])
})

test('startJobRunCore rejects when lock is already held', async () => {
  await assert.rejects(
    () =>
      startJobRunCore({
        jobName: 'billing-status-sync',
        jobRunId: 'job-run-1',
        trigger: 'scheduled',
        lockExpiresAtIso: '2026-03-01T00:15:00.000Z',
        async acquireLock() {
          return false
        },
        async insertJobRun() {
          throw new Error('unexpected insert')
        },
        async releaseLock() {},
      }),
    (error: unknown) =>
      error instanceof CronSharedCoreError &&
      error.status === 409 &&
      error.message === 'A recent running job already exists.'
  )
})

test('finishJobRunCore updates and releases lock', async () => {
  const calls: string[] = []

  await finishJobRunCore({
    jobRunId: 'job-run-1',
    status: 'succeeded',
    meta: { synced: 1 },
    async updateJobRun() {
      calls.push('update')
    },
    async releaseLock() {
      calls.push('release')
    },
  })

  assert.deepEqual(calls, ['update', 'release'])
})
