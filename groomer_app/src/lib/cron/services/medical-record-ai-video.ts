import { runMedicalRecordAiVideoJobs } from '@/lib/medical-records/ai-video-jobs'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function runMedicalRecordAiVideoPipeline() {
  const summary = await runMedicalRecordAiVideoJobs()
  const admin = createAdminSupabaseClient()

  const thresholdRaw = Number.parseInt(process.env.MEDICAL_RECORD_AI_VIDEO_FAILED_ALERT_THRESHOLD ?? '5', 10)
  const threshold = Number.isFinite(thresholdRaw) ? Math.max(1, thresholdRaw) : 5
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count: failedLastHourCount } = await admin
    .from('medical_record_ai_video_jobs' as never)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('completed_at', sinceIso)

  const failedLastHour = failedLastHourCount ?? 0
  const alertTriggered = failedLastHour >= threshold

  if (alertTriggered) {
    console.warn(
      `[medical-record-ai-video] failed jobs in last hour exceeded threshold: ${failedLastHour}/${threshold}`
    )
  }

  return {
    ...summary,
    monitoring: {
      failedLastHour,
      failedAlertThreshold: threshold,
      alertTriggered,
      windowHours: 1,
    },
  }
}
