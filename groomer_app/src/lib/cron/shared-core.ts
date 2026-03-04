export class CronSharedCoreError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'CronSharedCoreError'
    this.status = status
  }
}

export async function startJobRunCore(params: {
  jobName: string
  jobRunId: string
  trigger: 'scheduled' | 'manual_rerun' | 'manual_direct'
  requestedByUserId?: string | null
  sourceJobRunId?: string | null
  meta?: Record<string, unknown>
  lockExpiresAtIso: string
  acquireLock(params: { jobName: string; jobRunId: string; lockExpiresAtIso: string }): Promise<boolean>
  insertJobRun(params: {
    id: string
    jobName: string
    trigger: 'scheduled' | 'manual_rerun' | 'manual_direct'
    requestedByUserId?: string | null
    sourceJobRunId?: string | null
    meta?: Record<string, unknown>
  }): Promise<boolean>
  releaseLock(params: { jobRunId: string }): Promise<void>
}) {
  const locked = await params.acquireLock({
    jobName: params.jobName,
    jobRunId: params.jobRunId,
    lockExpiresAtIso: params.lockExpiresAtIso,
  })
  if (!locked) {
    throw new CronSharedCoreError('A recent running job already exists.', 409)
  }

  const inserted = await params.insertJobRun({
    id: params.jobRunId,
    jobName: params.jobName,
    trigger: params.trigger,
    requestedByUserId: params.requestedByUserId ?? null,
    sourceJobRunId: params.sourceJobRunId ?? null,
    meta: params.meta ?? {},
  })

  if (!inserted) {
    await params.releaseLock({ jobRunId: params.jobRunId })
    return null
  }

  return params.jobRunId
}

export async function finishJobRunCore(params: {
  jobRunId: string | null
  status: 'succeeded' | 'failed'
  meta?: Record<string, unknown>
  lastError?: string | null
  updateJobRun(params: {
    jobRunId: string
    status: 'succeeded' | 'failed'
    meta?: Record<string, unknown>
    lastError?: string | null
  }): Promise<void>
  releaseLock(params: { jobRunId: string }): Promise<void>
}) {
  if (!params.jobRunId) return
  await params.updateJobRun({
    jobRunId: params.jobRunId,
    status: params.status,
    meta: params.meta ?? {},
    lastError: params.lastError ?? null,
  })
  await params.releaseLock({ jobRunId: params.jobRunId })
}
