import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CronRerunServiceError,
  rerunCronJobCore,
  type RerunCronJobDeps,
} from '../src/lib/cron/services/rerun-core.ts'

test('rerunCronJobCore starts and finishes a manual rerun with source job id', async () => {
  const calls: string[] = []

  const deps: RerunCronJobDeps<'billing-status-sync', { synced: number }> = {
    isAllowedJobName(jobName): jobName is 'billing-status-sync' {
      return jobName === 'billing-status-sync'
    },
    async sourceJobRunExists(sourceJobRunId) {
      calls.push(`source:${sourceJobRunId}`)
      return true
    },
    async findRecentRunningJob() {
      calls.push('findRunning')
      return null
    },
    async startJobRun(params) {
      calls.push(`start:${params.trigger}:${params.sourceJobRunId}`)
      assert.equal(params.requestedByUserId, 'user-1')
      return 'job-run-2'
    },
    async runJob(jobName) {
      calls.push(`run:${jobName}`)
      return { synced: 3 }
    },
    async finishJobRun(params) {
      calls.push(`finish:${params.status}`)
      assert.equal(params.jobRunId, 'job-run-2')
      assert.deepEqual(params.meta, { synced: 3 })
    },
  }

  const result = await rerunCronJobCore({
    jobName: 'billing-status-sync',
    sourceJobRunId: 'job-run-1',
    requestedByUserId: 'user-1',
    reason: 'provider recovered',
    deps,
  })

  assert.equal(result.jobRunId, 'job-run-2')
  assert.equal(result.trigger, 'manual_rerun')
  assert.deepEqual(calls, [
    'source:job-run-1',
    'findRunning',
    'start:manual_rerun:job-run-1',
    'run:billing-status-sync',
    'finish:succeeded',
  ])
})

test('rerunCronJobCore rejects when a recent running job exists', async () => {
  const deps: RerunCronJobDeps<'billing-status-sync', { synced: number }> = {
    isAllowedJobName(jobName): jobName is 'billing-status-sync' {
      return jobName === 'billing-status-sync'
    },
    async sourceJobRunExists() {
      return true
    },
    async findRecentRunningJob() {
      return { id: 'running-1' }
    },
    async startJobRun() {
      throw new Error('unexpected start')
    },
    async runJob() {
      throw new Error('unexpected run')
    },
    async finishJobRun() {},
  }

  await assert.rejects(
    () =>
      rerunCronJobCore({
        jobName: 'billing-status-sync',
        requestedByUserId: 'user-1',
        deps,
      }),
    (error: unknown) =>
      error instanceof CronRerunServiceError &&
      error.status === 409 &&
      error.message === 'A recent running job already exists.'
  )
})
