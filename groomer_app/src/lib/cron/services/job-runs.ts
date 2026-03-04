import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { CronServiceError } from '@/lib/cron/shared'
import { isCronJobName } from '@/lib/cron/jobs'
import { listJobLockReleaseAuditsByJobRunId } from '@/lib/cron/services/job-lock-release-audits'
import {
  JobRunsServiceError,
  listFailedJobRunsCore,
  listJobRunsCore,
  type JobRunStatus,
  mapJobRun,
  type JobRunTrigger,
} from '@/lib/cron/services/job-runs-core'

async function fetchJobRuns(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  limit: number
  page: number
  jobName?: string
  status?: JobRunStatus
  trigger?: JobRunTrigger
  requestedByUserId?: string
  startedFrom?: string
  startedTo?: string
}) {
  const from = (params.page - 1) * params.limit
  const to = from + params.limit - 1

  let query = params.admin
    .from('job_runs')
    .select(
      'id, job_name, status, started_at, finished_at, retries, last_error, trigger, requested_by_user_id, source_job_run_id, meta',
      { count: 'exact' }
    )
    .order('started_at', { ascending: false })
    .range(from, to)

  if (params.jobName) {
    query = query.eq('job_name', params.jobName)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.trigger) {
    query = query.eq('trigger', params.trigger)
  }
  if (params.requestedByUserId) {
    query = query.eq('requested_by_user_id', params.requestedByUserId)
  }
  if (params.startedFrom) {
    query = query.gte('started_at', params.startedFrom)
  }
  if (params.startedTo) {
    query = query.lte('started_at', params.startedTo)
  }

  const { data, error, count } = await query
  if (error) {
    throw new JobRunsServiceError(error.message, 500)
  }

  return {
    rows: (data ?? []) as Array<{
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
    }>,
    totalCount: count ?? 0,
  }
}

export async function listJobRuns(params?: {
  limit?: number
  page?: number
  jobName?: string | null
  status?: string | null
  trigger?: string | null
  requestedByUserId?: string | null
  startedFrom?: string | null
  startedTo?: string | null
}) {
  const admin = createAdminSupabaseClient()
  try {
    return await listJobRunsCore({
      ...params,
      isAllowedJobName: isCronJobName,
      async fetchJobRuns(query) {
        return fetchJobRuns({ admin, ...query })
      },
    })
  } catch (error) {
    if (error instanceof JobRunsServiceError) {
      throw new CronServiceError(error.message, error.status)
    }
    if (error instanceof CronServiceError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    throw new CronServiceError(message, 500)
  }
}

export async function listFailedJobRuns(params?: {
  limit?: number
  page?: number
  jobName?: string | null
  trigger?: string | null
  requestedByUserId?: string | null
  startedFrom?: string | null
  startedTo?: string | null
}) {
  const admin = createAdminSupabaseClient()
  try {
    return await listFailedJobRunsCore({
      ...params,
      isAllowedJobName: isCronJobName,
      async fetchJobRuns(query) {
        return fetchJobRuns({ admin, ...query })
      },
    })
  } catch (error) {
    if (error instanceof JobRunsServiceError) {
      throw new CronServiceError(error.message, error.status)
    }
    if (error instanceof CronServiceError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    throw new CronServiceError(message, 500)
  }
}

export async function getJobRunById(jobRunId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('job_runs')
    .select(
      'id, job_name, status, started_at, finished_at, retries, last_error, trigger, requested_by_user_id, source_job_run_id, meta'
    )
    .eq('id', jobRunId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new CronServiceError(error.message, 500)
  }
  if (!data) {
    throw new CronServiceError('Job run not found.', 404)
  }

  return {
    item: mapJobRun(data),
    manualLockReleases: await listJobLockReleaseAuditsByJobRunId(jobRunId),
  }
}
