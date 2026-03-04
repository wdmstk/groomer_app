export class CronRerunServiceError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'CronRerunServiceError'
    this.status = status
  }
}

export type RerunCronJobDeps<TJobName extends string, TResult> = {
  isAllowedJobName(jobName: string): jobName is TJobName
  sourceJobRunExists(sourceJobRunId: string): Promise<boolean>
  findRecentRunningJob(jobName: TJobName): Promise<{ id: string } | null>
  startJobRun(params: {
    jobName: TJobName
    trigger: 'manual_rerun' | 'manual_direct'
    requestedByUserId: string
    sourceJobRunId: string | null
    meta: Record<string, unknown>
  }): Promise<string | null>
  runJob(jobName: TJobName): Promise<TResult>
  finishJobRun(params: {
    jobRunId: string | null
    status: 'succeeded' | 'failed'
    meta?: Record<string, unknown>
    lastError?: string | null
  }): Promise<void>
}

export async function rerunCronJobCore<TJobName extends string, TResult>(params: {
  jobName: string
  sourceJobRunId?: string | null
  requestedByUserId: string
  reason?: string | null
  deps: RerunCronJobDeps<TJobName, TResult>
}) {
  const { deps } = params
  if (!deps.isAllowedJobName(params.jobName)) {
    throw new CronRerunServiceError('Unsupported jobName.', 400)
  }

  const jobName = params.jobName
  if (params.sourceJobRunId) {
    const exists = await deps.sourceJobRunExists(params.sourceJobRunId)
    if (!exists) {
      throw new CronRerunServiceError('sourceJobRunId not found.', 404)
    }
  }

  const runningJob = await deps.findRecentRunningJob(jobName)
  if (runningJob?.id) {
    throw new CronRerunServiceError('A recent running job already exists.', 409)
  }

  const trigger = params.sourceJobRunId ? 'manual_rerun' : 'manual_direct'
  const meta = {
    reason: params.reason ?? null,
  }

  let jobRunId: string | null = null
  try {
    jobRunId = await deps.startJobRun({
      jobName,
      trigger,
      requestedByUserId: params.requestedByUserId,
      sourceJobRunId: params.sourceJobRunId ?? null,
      meta,
    })
    const result = await deps.runJob(jobName)
    await deps.finishJobRun({ jobRunId, status: 'succeeded', meta: result as Record<string, unknown> })
    return {
      jobRunId,
      jobName,
      trigger,
      result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    await deps.finishJobRun({ jobRunId, status: 'failed', lastError: message })
    if (error instanceof CronRerunServiceError) {
      throw error
    }
    throw new CronRerunServiceError(message, 500)
  }
}
