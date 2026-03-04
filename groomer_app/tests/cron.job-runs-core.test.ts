import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JobRunsServiceError,
  listJobRunsCore,
  listFailedJobRunsCore,
} from '../src/lib/cron/services/job-runs-core.ts'

test('listFailedJobRunsCore clamps limit and maps rows', async () => {
  let capturedLimit = 0

  const result = await listFailedJobRunsCore({
    limit: 500,
    jobName: 'billing-status-sync',
    isAllowedJobName(jobName): jobName is 'billing-status-sync' {
      return jobName === 'billing-status-sync'
    },
    async fetchJobRuns({ limit, jobName }) {
      capturedLimit = limit
      assert.equal(jobName, 'billing-status-sync')
      return {
        rows: [
          {
            id: 'job-1',
            job_name: 'billing-status-sync',
            status: 'failed',
            started_at: '2026-03-01T00:00:00.000Z',
            finished_at: '2026-03-01T00:01:00.000Z',
            retries: 1,
            last_error: 'network timeout',
            trigger: 'scheduled',
            requested_by_user_id: null,
            source_job_run_id: null,
            meta: { scanned: 5 },
          },
        ],
        totalCount: 1,
      }
    },
  })

  assert.equal(capturedLimit, 100)
  assert.deepEqual(result.items[0], {
    id: 'job-1',
    jobName: 'billing-status-sync',
    status: 'failed',
    startedAt: '2026-03-01T00:00:00.000Z',
    finishedAt: '2026-03-01T00:01:00.000Z',
    retries: 1,
    lastError: 'network timeout',
    trigger: 'scheduled',
    requestedByUserId: null,
    sourceJobRunId: null,
    meta: { scanned: 5 },
  })
})

test('listFailedJobRunsCore rejects unsupported job names', async () => {
  await assert.rejects(
    () =>
      listFailedJobRunsCore({
        jobName: 'unknown-job',
        isAllowedJobName(jobName: string): jobName is never {
          return false
        },
        async fetchJobRuns() {
          throw new Error('unexpected fetch')
        },
      }),
    (error: unknown) =>
      error instanceof JobRunsServiceError &&
      error.status === 400 &&
      error.message === 'Unsupported jobName.'
  )
})

test('listJobRunsCore passes status, page, and date filters and returns pagination info', async () => {
  const received: Record<string, unknown>[] = []

  const result = await listJobRunsCore({
    limit: 10,
    page: 2,
    jobName: 'billing-status-sync',
    status: 'running',
    trigger: 'manual_direct',
    requestedByUserId: ' user-1 ',
    startedFrom: '2026-03-01T00:00:00.000Z',
    startedTo: '2026-03-02T00:00:00.000Z',
    isAllowedJobName(jobName): jobName is 'billing-status-sync' {
      return jobName === 'billing-status-sync'
    },
    async fetchJobRuns(input) {
      received.push(input as Record<string, unknown>)
      return {
        rows: [
          {
            id: 'job-2',
            job_name: 'billing-status-sync',
            status: 'running',
            started_at: '2026-03-01T10:00:00.000Z',
            finished_at: null,
            retries: 0,
            last_error: null,
            trigger: 'manual_direct',
            requested_by_user_id: 'user-1',
            source_job_run_id: null,
            meta: {},
          },
        ],
        totalCount: 25,
      }
    },
  })

  assert.deepEqual(received, [
    {
      limit: 10,
      page: 2,
      jobName: 'billing-status-sync',
      status: 'running',
      trigger: 'manual_direct',
      requestedByUserId: 'user-1',
      startedFrom: '2026-03-01T00:00:00.000Z',
      startedTo: '2026-03-02T00:00:00.000Z',
    },
  ])
  assert.equal(result.page, 2)
  assert.equal(result.limit, 10)
  assert.equal(result.totalCount, 25)
  assert.equal(result.hasMore, true)
  assert.equal(result.items[0].status, 'running')
})

test('listJobRunsCore rejects unsupported trigger values', async () => {
  await assert.rejects(
    () =>
      listJobRunsCore({
        trigger: 'unknown-trigger',
        isAllowedJobName(jobName): jobName is 'billing-status-sync' {
          return jobName === 'billing-status-sync'
        },
        async fetchJobRuns() {
          throw new Error('unexpected fetch')
        },
      }),
    (error: unknown) =>
      error instanceof JobRunsServiceError &&
      error.status === 400 &&
      error.message === 'Unsupported trigger.'
  )
})
