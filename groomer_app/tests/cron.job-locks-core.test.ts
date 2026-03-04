import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendManualLockReleaseAudit,
  JobLocksServiceError,
  validateReleaseJobLockInput,
} from '../src/lib/cron/services/job-locks-core.ts'

test('appendManualLockReleaseAudit preserves existing meta and appends audit entry', () => {
  const result = appendManualLockReleaseAudit({
    currentMeta: {
      scanned: 3,
      audit: {
        manualLockReleases: [
          {
            releasedAt: '2026-03-01T00:00:00.000Z',
            requestedByUserId: 'user-0',
            requestedByEmail: 'prev@example.com',
            lockJobName: 'billing-status-sync',
            lockJobRunId: 'job-0',
          },
        ],
      },
    },
    releasedAt: '2026-03-01T01:00:00.000Z',
    requestedByUserId: 'user-1',
    requestedByEmail: 'admin@example.com',
    lockJobName: 'billing-status-sync',
    lockJobRunId: 'job-1',
  })

  assert.equal('scanned' in result ? result.scanned : undefined, 3)
  assert.equal(Array.isArray(result.audit.manualLockReleases), true)
  assert.equal(result.audit.manualLockReleases.length, 2)
  assert.deepEqual(result.audit.manualLockReleases[1], {
    releasedAt: '2026-03-01T01:00:00.000Z',
    requestedByUserId: 'user-1',
    requestedByEmail: 'admin@example.com',
    lockJobName: 'billing-status-sync',
    lockJobRunId: 'job-1',
  })
})

test('appendManualLockReleaseAudit keeps only the latest 20 entries', () => {
  const currentEntries = Array.from({ length: 20 }, (_, index) => ({
    releasedAt: `2026-03-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    requestedByUserId: `user-${index}`,
    requestedByEmail: null,
    lockJobName: 'billing-status-sync',
    lockJobRunId: `job-${index}`,
  }))

  const result = appendManualLockReleaseAudit({
    currentMeta: {
      audit: {
        manualLockReleases: currentEntries,
      },
    },
    releasedAt: '2026-03-01T01:00:00.000Z',
    requestedByUserId: 'user-20',
    requestedByEmail: null,
    lockJobName: 'billing-status-sync',
    lockJobRunId: 'job-20',
  })

  assert.equal(result.audit.manualLockReleases.length, 20)
  assert.equal(result.audit.manualLockReleases[0].lockJobRunId, 'job-1')
  assert.equal(result.audit.manualLockReleases[19].lockJobRunId, 'job-20')
})

test('validateReleaseJobLockInput rejects blank values', () => {
  assert.throws(
    () =>
      validateReleaseJobLockInput({
        jobRunId: ' ',
        requestedByUserId: 'user-1',
      }),
    (error: unknown) =>
      error instanceof JobLocksServiceError &&
      error.status === 400 &&
      error.message === 'jobRunId is required.'
  )

  assert.throws(
    () =>
      validateReleaseJobLockInput({
        jobRunId: 'job-1',
        requestedByUserId: ' ',
      }),
    (error: unknown) =>
      error instanceof JobLocksServiceError &&
      error.status === 400 &&
      error.message === 'requestedByUserId is required.'
  )
})
