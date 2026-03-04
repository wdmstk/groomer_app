import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { CronServiceError } from '@/lib/cron/shared'

type JobLockReleaseAuditRow = {
  id: string
  released_at: string
  job_run_id: string
  job_name: string
  requested_by_user_id: string
  requested_by_email: string | null
  lock_job_run_id: string
  lock_job_name: string
}

function mapJobLockReleaseAudit(row: JobLockReleaseAuditRow) {
  return {
    id: row.id,
    releasedAt: row.released_at,
    jobRunId: row.job_run_id,
    jobName: row.job_name,
    requestedByUserId: row.requested_by_user_id,
    requestedByEmail: row.requested_by_email,
    lockJobRunId: row.lock_job_run_id,
    lockJobName: row.lock_job_name,
  }
}

export async function listJobLockReleaseAuditsByJobRunId(jobRunId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('job_lock_release_audits')
    .select(
      'id, released_at, job_run_id, job_name, requested_by_user_id, requested_by_email, lock_job_run_id, lock_job_name'
    )
    .eq('job_run_id', jobRunId)
    .order('released_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new CronServiceError(error.message, 500)
  }

  return ((data ?? []) as JobLockReleaseAuditRow[]).map(mapJobLockReleaseAudit)
}
