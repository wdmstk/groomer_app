import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { CronServiceError, finishJobRun, startJobRun } from '@/lib/cron/shared'
import { isCronJobName, runCronJobByName, type CronJobName } from '@/lib/cron/jobs'
import { CronRerunServiceError, rerunCronJobCore } from '@/lib/cron/services/rerun-core'

const RUNNING_WINDOW_MINUTES = 15

type JobRunRow = {
  id: string
}

export async function rerunCronJob(params: {
  jobName: string
  sourceJobRunId?: string | null
  requestedByUserId: string
  reason?: string | null
}) {
  const admin = createAdminSupabaseClient()
  const runningSince = new Date(Date.now() - RUNNING_WINDOW_MINUTES * 60 * 1000).toISOString()
  try {
    return await rerunCronJobCore<CronJobName, Json>({
      ...params,
      deps: {
        isAllowedJobName: isCronJobName,
        async sourceJobRunExists(sourceJobRunId) {
          const { data: sourceJob, error } = await admin
            .from('job_runs')
            .select('id')
            .eq('id', sourceJobRunId)
            .limit(1)
            .maybeSingle()
          if (error) {
            throw new CronRerunServiceError(error.message, 500)
          }
          return Boolean(sourceJob?.id)
        },
        async findRecentRunningJob(jobName) {
          const { data, error } = await admin
            .from('job_runs')
            .select('id')
            .eq('job_name', jobName)
            .eq('status', 'running')
            .gte('started_at', runningSince)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (error) {
            throw new CronRerunServiceError(error.message, 500)
          }
          return (data as JobRunRow | null) ?? null
        },
        async startJobRun({ jobName, trigger, requestedByUserId, sourceJobRunId, meta }) {
          return startJobRun({
            jobName,
            trigger,
            requestedByUserId,
            sourceJobRunId,
            meta,
          })
        },
        async runJob(jobName) {
          return runCronJobByName(jobName)
        },
        async finishJobRun(params) {
          await finishJobRun(params)
        },
      },
    })
  } catch (error) {
    if (error instanceof CronRerunServiceError) {
      throw new CronServiceError(error.message, error.status)
    }
    if (error instanceof CronServiceError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    throw new CronServiceError(message, 500)
  }
}
