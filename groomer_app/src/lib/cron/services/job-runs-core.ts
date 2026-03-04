export class JobRunsServiceError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'JobRunsServiceError'
    this.status = status
  }
}

export const JOB_RUN_STATUSES = ['running', 'succeeded', 'failed'] as const

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number]

export const JOB_RUN_TRIGGERS = ['scheduled', 'manual_rerun', 'manual_direct'] as const

export type JobRunTrigger = (typeof JOB_RUN_TRIGGERS)[number]

type RawJobRun = {
  id: string
  job_name: string
  status: string
  started_at: string
  finished_at: string | null
  retries: number
  last_error: string | null
  trigger: string
  requested_by_user_id: string | null
  source_job_run_id: string | null
  meta: Record<string, unknown> | null
}

type JobRunListResult = {
  rows: RawJobRun[]
  totalCount: number
}

export async function listJobRunsCore<TJobName extends string>(params: {
  limit?: number
  page?: number
  jobName?: string | null
  status?: string | null
  trigger?: string | null
  requestedByUserId?: string | null
  startedFrom?: string | null
  startedTo?: string | null
  isAllowedJobName(jobName: string): jobName is TJobName
  fetchJobRuns(input: {
    limit: number
    page: number
    jobName?: TJobName
    status?: JobRunStatus
    trigger?: JobRunTrigger
    requestedByUserId?: string
    startedFrom?: string
    startedTo?: string
  }): Promise<JobRunListResult>
}) {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
  const page = Math.max(params.page ?? 1, 1)
  if (params.jobName && !params.isAllowedJobName(params.jobName)) {
    throw new JobRunsServiceError('Unsupported jobName.', 400)
  }
  if (params.status && !JOB_RUN_STATUSES.includes(params.status as JobRunStatus)) {
    throw new JobRunsServiceError('Unsupported status.', 400)
  }
  if (params.trigger && !JOB_RUN_TRIGGERS.includes(params.trigger as JobRunTrigger)) {
    throw new JobRunsServiceError('Unsupported trigger.', 400)
  }
  if (params.startedFrom && Number.isNaN(new Date(params.startedFrom).getTime())) {
    throw new JobRunsServiceError('Invalid startedFrom.', 400)
  }
  if (params.startedTo && Number.isNaN(new Date(params.startedTo).getTime())) {
    throw new JobRunsServiceError('Invalid startedTo.', 400)
  }

  const result = await params.fetchJobRuns({
    limit,
    page,
    jobName: (params.jobName as TJobName | null | undefined) ?? undefined,
    status: (params.status as JobRunStatus | null | undefined) ?? undefined,
    trigger: (params.trigger as JobRunTrigger | null | undefined) ?? undefined,
    requestedByUserId: params.requestedByUserId?.trim() || undefined,
    startedFrom: params.startedFrom ?? undefined,
    startedTo: params.startedTo ?? undefined,
  })

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      jobName: row.job_name,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      retries: row.retries,
      lastError: row.last_error,
      trigger: row.trigger,
      requestedByUserId: row.requested_by_user_id,
      sourceJobRunId: row.source_job_run_id,
      meta: row.meta ?? {},
    })),
    page,
    limit,
    totalCount: result.totalCount,
    hasMore: page * limit < result.totalCount,
  }
}

export async function listFailedJobRunsCore<TJobName extends string>(params: {
  limit?: number
  page?: number
  jobName?: string | null
  trigger?: string | null
  requestedByUserId?: string | null
  startedFrom?: string | null
  startedTo?: string | null
  isAllowedJobName(jobName: string): jobName is TJobName
  fetchJobRuns(input: {
    limit: number
    page: number
    jobName?: TJobName
    status?: JobRunStatus
    trigger?: JobRunTrigger
    requestedByUserId?: string
    startedFrom?: string
    startedTo?: string
  }): Promise<JobRunListResult>
}) {
  return listJobRunsCore({
    ...params,
    status: 'failed',
    fetchJobRuns: params.fetchJobRuns,
  })
}

export function mapJobRun(row: RawJobRun) {
  return {
    id: row.id,
    jobName: row.job_name,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    retries: row.retries,
    lastError: row.last_error,
    trigger: row.trigger,
    requestedByUserId: row.requested_by_user_id,
    sourceJobRunId: row.source_job_run_id,
    meta: row.meta ?? {},
  }
}
