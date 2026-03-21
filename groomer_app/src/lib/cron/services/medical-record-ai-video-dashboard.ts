import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { CronServiceError } from '@/lib/cron/shared'

type VideoAiJobRow = {
  id: string
  tier: string
  status: string
  provider: string | null
  attempts: number
  created_at: string
  completed_at: string | null
  error_message: string | null
}

type JobRunRow = {
  id: string
  status: string
  trigger: string
  started_at: string
  finished_at: string | null
  last_error: string | null
}

export async function getMedicalRecordAiVideoDashboard(params?: { limit?: number }) {
  const admin = createAdminSupabaseClient()
  const limit = Math.max(5, Math.min(100, Math.floor(params?.limit ?? 30)))
  const thresholdRaw = Number.parseInt(process.env.MEDICAL_RECORD_AI_VIDEO_FAILED_ALERT_THRESHOLD ?? '5', 10)
  const failedAlertThreshold = Number.isFinite(thresholdRaw) ? Math.max(1, thresholdRaw) : 5
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [latestJobsResult, latestRunsResult, failed1hResult, total1hResult, failed24hResult, total24hResult] =
    await Promise.all([
      admin
        .from('medical_record_ai_video_jobs' as never)
        .select('id, tier, status, provider, attempts, created_at, completed_at, error_message')
        .order('created_at', { ascending: false })
        .limit(limit),
      admin
        .from('job_runs')
        .select('id, status, trigger, started_at, finished_at, last_error')
        .eq('job_name', 'medical-record-ai-video')
        .order('started_at', { ascending: false })
        .limit(limit),
      admin
        .from('medical_record_ai_video_jobs' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since1h),
      admin
        .from('medical_record_ai_video_jobs' as never)
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since1h),
      admin
        .from('medical_record_ai_video_jobs' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since24h),
      admin
        .from('medical_record_ai_video_jobs' as never)
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h),
    ])

  if (latestJobsResult.error) throw new CronServiceError(latestJobsResult.error.message, 500)
  if (latestRunsResult.error) throw new CronServiceError(latestRunsResult.error.message, 500)
  if (failed1hResult.error) throw new CronServiceError(failed1hResult.error.message, 500)
  if (total1hResult.error) throw new CronServiceError(total1hResult.error.message, 500)
  if (failed24hResult.error) throw new CronServiceError(failed24hResult.error.message, 500)
  if (total24hResult.error) throw new CronServiceError(total24hResult.error.message, 500)

  const failedLastHour = failed1hResult.count ?? 0
  const totalLastHour = total1hResult.count ?? 0
  const failedLast24h = failed24hResult.count ?? 0
  const totalLast24h = total24hResult.count ?? 0

  return {
    monitoring: {
      failedLastHour,
      totalLastHour,
      failedRateLastHour: totalLastHour > 0 ? Number(((failedLastHour / totalLastHour) * 100).toFixed(2)) : 0,
      failedAlertThreshold,
      alertTriggered: failedLastHour >= failedAlertThreshold,
      failedLast24h,
      totalLast24h,
      failedRateLast24h: totalLast24h > 0 ? Number(((failedLast24h / totalLast24h) * 100).toFixed(2)) : 0,
    },
    latestVideoJobs: ((latestJobsResult.data ?? []) as VideoAiJobRow[]).map((row) => ({
      id: row.id,
      tier: row.tier,
      status: row.status,
      provider: row.provider,
      attempts: row.attempts,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    })),
    latestJobRuns: ((latestRunsResult.data ?? []) as JobRunRow[]).map((row) => ({
      id: row.id,
      status: row.status,
      trigger: row.trigger,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      lastError: row.last_error,
    })),
  }
}
