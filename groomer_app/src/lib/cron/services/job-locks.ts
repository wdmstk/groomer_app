import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { CronServiceError } from '@/lib/cron/shared'
import {
  appendManualLockReleaseAudit,
  JobLocksServiceError,
  validateReleaseJobLockInput,
} from '@/lib/cron/services/job-locks-core'

type JobLockRow = {
  job_name: string
  job_run_id: string
  expires_at: string
  created_at: string
  updated_at: string
}

type JobRunMetaRow = {
  id: string
  meta: Json | null
}

export async function listJobLocks() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('job_locks')
    .select('job_name, job_run_id, expires_at, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new CronServiceError(error.message, 500)
  }

  return {
    items: ((data ?? []) as JobLockRow[]).map((row) => ({
      jobName: row.job_name,
      jobRunId: row.job_run_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
}

export async function releaseJobLock(params: {
  jobRunId: string
  requestedByUserId: string
  requestedByEmail?: string | null
}) {
  try {
    validateReleaseJobLockInput(params)

    const admin = createAdminSupabaseClient()
    const { data: lockRow, error: lockError } = await admin
      .from('job_locks')
      .select('job_name, job_run_id, expires_at, created_at, updated_at')
      .eq('job_run_id', params.jobRunId)
      .maybeSingle()

    if (lockError) {
      throw new JobLocksServiceError(lockError.message, 500)
    }
    if (!lockRow) {
      throw new JobLocksServiceError('Job lock not found.', 404)
    }

    const { data: jobRunRow, error: jobRunError } = await admin
      .from('job_runs')
      .select('id, meta')
      .eq('id', params.jobRunId)
      .maybeSingle()

    if (jobRunError) {
      throw new JobLocksServiceError(jobRunError.message, 500)
    }

    const { error: releaseError } = await admin.rpc('release_job_lock', {
      lock_job_run_id: params.jobRunId,
    })

    if (releaseError) {
      throw new JobLocksServiceError(releaseError.message, 500)
    }

    const releasedAt = new Date().toISOString()
    const nextMeta = appendManualLockReleaseAudit({
      currentMeta: (jobRunRow as JobRunMetaRow | null)?.meta,
      releasedAt,
      requestedByUserId: params.requestedByUserId,
      requestedByEmail: params.requestedByEmail ?? null,
      lockJobName: (lockRow as JobLockRow).job_name,
      lockJobRunId: (lockRow as JobLockRow).job_run_id,
    })

    const { error: auditInsertError } = await admin.from('job_lock_release_audits').insert({
      released_at: releasedAt,
      job_run_id: params.jobRunId,
      job_name: (lockRow as JobLockRow).job_name,
      requested_by_user_id: params.requestedByUserId,
      requested_by_email: params.requestedByEmail ?? null,
      lock_job_run_id: (lockRow as JobLockRow).job_run_id,
      lock_job_name: (lockRow as JobLockRow).job_name,
    })

    if (auditInsertError) {
      throw new JobLocksServiceError(
        `Job lock released, but audit logging failed: ${auditInsertError.message}`,
        500
      )
    }

    const { error: updateError } = await admin
      .from('job_runs')
      .update({
        meta: nextMeta,
        updated_at: releasedAt,
      })
      .eq('id', params.jobRunId)

    if (updateError) {
      throw new JobLocksServiceError(`Job lock released, but meta update failed: ${updateError.message}`, 500)
    }

    return {
      message: 'Job lock released.',
      jobRunId: params.jobRunId,
      releasedAt,
    }
  } catch (error) {
    if (error instanceof JobLocksServiceError) {
      throw new CronServiceError(error.message, error.status)
    }
    throw error
  }
}
