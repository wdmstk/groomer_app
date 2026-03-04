import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  CronSharedCoreError,
  finishJobRunCore,
  startJobRunCore,
} from '@/lib/cron/shared-core'

export class CronServiceError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'CronServiceError'
    this.status = status
  }
}

export function assertAuthorizedCronRequest(request: Request) {
  const expected = process.env.CRON_SECRET_KEY
  if (!expected) {
    throw new CronServiceError('CRON_SECRET_KEY is not configured.', 500)
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expected}`) {
    throw new CronServiceError('Unauthorized', 401)
  }
}

export async function startJobRun(params: {
  jobName: string
  trigger?: 'scheduled' | 'manual_rerun' | 'manual_direct'
  requestedByUserId?: string | null
  sourceJobRunId?: string | null
  lockTimeoutMinutes?: number
  meta?: Record<string, unknown>
}) {
  try {
    const admin = createAdminSupabaseClient()
    const jobRunId = crypto.randomUUID()
    const lockExpiresAtIso = new Date(
      Date.now() + (params.lockTimeoutMinutes ?? 15) * 60 * 1000
    ).toISOString()
    return await startJobRunCore({
      jobName: params.jobName,
      jobRunId,
      trigger: params.trigger ?? 'scheduled',
      requestedByUserId: params.requestedByUserId ?? null,
      sourceJobRunId: params.sourceJobRunId ?? null,
      meta: params.meta ?? {},
      lockExpiresAtIso,
      async acquireLock({ jobName, jobRunId, lockExpiresAtIso }) {
        const { data, error } = await admin.rpc('acquire_job_lock', {
          lock_job_name: jobName,
          lock_job_run_id: jobRunId,
          lock_expires_at: lockExpiresAtIso,
        })
        if (error) {
          throw error
        }
        return Boolean(data)
      },
      async insertJobRun({ id, jobName, trigger, requestedByUserId, sourceJobRunId, meta }) {
        const { data, error } = await admin
          .from('job_runs')
          .insert({
            id,
            job_name: jobName,
            status: 'running',
            started_at: new Date().toISOString(),
            trigger,
            requested_by_user_id: requestedByUserId,
            source_job_run_id: sourceJobRunId,
            meta,
          })
          .select('id')
          .single()
        return !error && Boolean(data?.id)
      },
      async releaseLock({ jobRunId }) {
        await admin.rpc('release_job_lock', {
          lock_job_run_id: jobRunId,
        })
      },
    })
  } catch (error) {
    if (error instanceof CronSharedCoreError) {
      throw new CronServiceError(error.message, error.status)
    }
    const message = error instanceof Error ? error.message : ''
    if (message.includes('acquire_job_lock')) {
      return null
    }
    if (message.includes('release_job_lock')) {
      return null
    }
    return null
  }
}

export async function finishJobRun(params: {
  jobRunId: string | null
  status: 'succeeded' | 'failed'
  meta?: Record<string, unknown>
  lastError?: string | null
}) {
  if (!params.jobRunId) return
  try {
    const admin = createAdminSupabaseClient()
    await finishJobRunCore({
      jobRunId: params.jobRunId,
      status: params.status,
      meta: params.meta ?? {},
      lastError: params.lastError ?? null,
      async updateJobRun({ jobRunId, status, meta, lastError }) {
        await admin
          .from('job_runs')
          .update({
            status,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            meta,
            last_error: lastError,
          })
          .eq('id', jobRunId)
      },
      async releaseLock({ jobRunId }) {
        await admin.rpc('release_job_lock', {
          lock_job_run_id: jobRunId,
        })
      },
    })
  } catch {
    // best-effort logging
  }
}
