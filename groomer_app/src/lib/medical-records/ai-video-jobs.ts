import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { MedicalRecordSupabaseClient } from '@/lib/medical-records/services/shared'
import { parseAiPlanCode, type AiPlanCode } from '@/lib/billing/pricing'
import { hasAiAssistAccess } from '@/lib/medical-records/ai-assist'
import { hasAiProAccess } from '@/lib/medical-records/ai-pro'
import {
  buildAiProPlusHighlightPath,
  deriveMedicalRecordAiProPlusHealthInsight,
  hasAiProPlusAccess,
} from '@/lib/medical-records/ai-pro-plus'
import { buildMedicalRecordLineShortVideoPath, getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'
import { createVideoClipWithFfmpeg } from '@/lib/medical-records/video-processing'
import { createLlmAdapter } from '@/lib/ai/llm-adapter'
import { createVideoAiAdapter } from '@/lib/ai/video-ai-adapter'
import { isObjectRecord } from '@/lib/object-utils'

export type AiVideoTier = 'assist' | 'pro' | 'pro_plus'
type AiVideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'

type AiVideoJobSource = 'manual' | 'retry'

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()

function asObject(value: unknown): { [key: string]: unknown } | null {
  if (!isObjectRecord(value)) return null
  return value
}

async function resolveAiPlanCode(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
}) {
  const { data: subscription } = await params.admin
    .from('store_subscriptions')
    .select('ai_plan_code')
    .eq('store_id', params.storeId)
    .maybeSingle()

  return parseAiPlanCode((subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ?? 'none')
}

function ensureTierAccess(tier: AiVideoTier, aiPlanCode: AiPlanCode) {
  if (tier === 'assist') {
    if (!hasAiAssistAccess(aiPlanCode)) {
      throw new Error('AI Assist以上の契約が必要です。')
    }
    return
  }
  if (tier === 'pro') {
    if (!hasAiProAccess(aiPlanCode)) {
      throw new Error('AI Pro以上の契約が必要です。')
    }
    return
  }
  if (!hasAiProPlusAccess(aiPlanCode)) {
    throw new Error('AI Pro+の契約が必要です。')
  }
}

export async function enqueueMedicalRecordVideoAiJob(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  medicalRecordId: string
  medicalRecordVideoId: string
  requestedByUserId?: string | null
  tier: AiVideoTier
  source?: AiVideoJobSource
  force?: boolean
}) {
  const source = params.source ?? 'manual'

  if (!params.force) {
    const { data: existing } = await params.supabase
      .from('medical_record_ai_video_jobs' as never)
      .select('id, status, tier')
      .eq('store_id', params.storeId)
      .eq('medical_record_video_id', params.medicalRecordVideoId)
      .eq('tier', params.tier)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (existing) {
      return existing as { id: string; status: AiVideoJobStatus; tier: AiVideoTier }
    }
  }

  const { data, error } = await params.supabase
    .from('medical_record_ai_video_jobs' as never)
    .insert({
      store_id: params.storeId,
      medical_record_id: params.medicalRecordId,
      medical_record_video_id: params.medicalRecordVideoId,
      requested_by_user_id: params.requestedByUserId ?? null,
      tier: params.tier,
      source,
      status: 'queued',
    } as never)
    .select('id, status, tier')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as { id: string; status: AiVideoJobStatus; tier: AiVideoTier }
}

async function ensureLineShortClip(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
  medicalRecordId: string
  videoId: string
  sourcePath: string
  durationSec: number | null
  existingLineShortPath: string | null
}) {
  if (params.existingLineShortPath) {
    return {
      lineShortPath: params.existingLineShortPath,
      method: 'existing' as const,
    }
  }

  const lineShortPath = buildMedicalRecordLineShortVideoPath({
    storeId: params.storeId,
    medicalRecordId: params.medicalRecordId,
    sourcePath: params.sourcePath,
  })

  const targetDuration =
    typeof params.durationSec === 'number' && Number.isFinite(params.durationSec)
      ? Math.max(10, Math.min(20, Math.floor(params.durationSec)))
      : 15

  let method: 'ffmpeg' | 'copy' = 'copy'
  let uploaded = false

  const { data: sourceBlob } = await params.admin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .download(params.sourcePath)

  if (sourceBlob) {
    try {
      const clip = await createVideoClipWithFfmpeg({
        sourceBlob,
        outputExt: 'mp4',
        startSec: 0,
        durationSec: targetDuration,
      })

      const { error: uploadError } = await params.admin.storage
        .from(VIDEO_STORAGE_BUCKET)
        .upload(lineShortPath, clip.clipBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        })

      if (!uploadError) {
        method = 'ffmpeg'
        uploaded = true
      }
    } catch {
      uploaded = false
    }
  }

  if (!uploaded) {
    const { error: copyError } = await params.admin.storage
      .from(VIDEO_STORAGE_BUCKET)
      .copy(params.sourcePath, lineShortPath)

    if (copyError) {
      throw new Error(copyError.message)
    }
    method = 'copy'
  }

  const { error: updateError } = await params.admin
    .from('medical_record_videos' as never)
    .update({
      line_short_path: lineShortPath,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', params.videoId)
    .eq('store_id', params.storeId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    lineShortPath,
    method,
  }
}

async function markFailed(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  jobId: string
  message: string
}) {
  const now = new Date().toISOString()
  await params.admin
    .from('medical_record_ai_video_jobs' as never)
    .update({
      status: 'failed',
      error_message: params.message,
      completed_at: now,
      updated_at: now,
    } as never)
    .eq('id', params.jobId)
}

export async function runMedicalRecordAiVideoJobs(params?: { limit?: number }) {
  const admin = createAdminSupabaseClient()
  const llm = createLlmAdapter()
  const videoAi = createVideoAiAdapter()
  const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50)

  const { data: jobs, error } = await admin
    .from('medical_record_ai_video_jobs' as never)
    .select('*')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  const summary = {
    scanned: (jobs as unknown[] | null)?.length ?? 0,
    completed: 0,
    failed: 0,
  }

  for (const item of (jobs as unknown[] | null) ?? []) {
    const row = asObject(item)
    if (!row) continue

    const jobId = String(row.id ?? '')
    const storeId = String(row.store_id ?? '')
    const recordId = String(row.medical_record_id ?? '')
    const videoId = String(row.medical_record_video_id ?? '')
    const tier = (row.tier === 'assist' || row.tier === 'pro' || row.tier === 'pro_plus' ? row.tier : 'assist') as AiVideoTier
    const attempts = Number(row.attempts ?? 0)

    if (!jobId || !storeId || !recordId || !videoId) continue

    const startAt = new Date().toISOString()
    const { error: startError } = await admin
      .from('medical_record_ai_video_jobs' as never)
      .update({
        status: 'processing',
        started_at: startAt,
        attempts: attempts + 1,
        updated_at: startAt,
      } as never)
      .eq('id', jobId)
      .eq('status', 'queued')

    if (startError) {
      summary.failed += 1
      await markFailed({ admin, jobId, message: startError.message })
      continue
    }

    try {
      const aiPlanCode = await resolveAiPlanCode({ admin, storeId })
      ensureTierAccess(tier, aiPlanCode)

      const [{ data: video, error: videoError }, { data: record, error: recordError }] = await Promise.all([
        admin
          .from('medical_record_videos' as never)
          .select('id, medical_record_id, storage_path, line_short_path, duration_sec, sort_order, taken_at')
          .eq('id', videoId)
          .eq('store_id', storeId)
          .maybeSingle(),
        admin
          .from('medical_records')
          .select('id, pet_id, menu, behavior_notes, skin_condition, tags')
          .eq('id', recordId)
          .eq('store_id', storeId)
          .maybeSingle(),
      ])

      if (videoError) throw new Error(videoError.message)
      if (recordError) throw new Error(recordError.message)
      const sourceVideo = video as {
        id: string
        medical_record_id: string | null
        storage_path: string | null
        line_short_path: string | null
        duration_sec: number | null
        sort_order: number | null
        taken_at: string | null
      } | null
      const sourceRecord = record as {
        id: string
        pet_id: string | null
        menu: string | null
        behavior_notes: string | null
        skin_condition: string | null
        tags: unknown
      } | null
      if (!sourceVideo?.id || !sourceVideo.storage_path || !sourceRecord?.id || !sourceRecord.pet_id) {
        throw new Error('動画またはカルテが見つかりません。')
      }

      const { data: pet } = await admin
        .from('pets')
        .select('id, name')
        .eq('id', sourceRecord.pet_id)
        .eq('store_id', storeId)
        .maybeSingle()

      const petName = (pet?.name as string | null) ?? 'ペット'
      const tags = Array.isArray(sourceRecord.tags) ? sourceRecord.tags.filter((value): value is string => typeof value === 'string') : []

      let resultPayload: { [key: string]: unknown } = {}
      let jobProvider: string | null = null

      if (tier === 'assist') {
        const clip = await ensureLineShortClip({
          admin,
          storeId,
          medicalRecordId: sourceRecord.id,
          videoId,
          sourcePath: sourceVideo.storage_path,
          durationSec: typeof sourceVideo.duration_sec === 'number' ? sourceVideo.duration_sec : null,
          existingLineShortPath: typeof sourceVideo.line_short_path === 'string' ? sourceVideo.line_short_path : null,
        })

        const output = await llm.assist({
          aiPlanCode,
          petName,
          menu: sourceRecord.menu ?? null,
          behaviorNotes: sourceRecord.behavior_notes ?? null,
          skinCondition: sourceRecord.skin_condition ?? null,
          durationSec: typeof sourceVideo.duration_sec === 'number' ? sourceVideo.duration_sec : null,
        })

        resultPayload = {
          lineShortPath: clip.lineShortPath,
          lineShortMethod: clip.method,
          caption: output.caption,
          summary: output.summary,
          telops: output.telops,
          lineOptimization: {
            targetDurationSec: 10,
            maxDurationSec: 20,
          },
          provider: output.provider,
          billing: output.billing ?? null,
        }
        jobProvider = output.provider
      } else if (tier === 'pro') {
        const output = await llm.pro({
          aiPlanCode,
          petName,
          behaviorNotes: sourceRecord.behavior_notes ?? null,
          skinCondition: sourceRecord.skin_condition ?? null,
          tags,
        })

        resultPayload = {
          estimatedSteps: output.steps,
          cooperationHint: output.cooperationHint,
          stressHint: output.stressHint,
          draft: output.draft,
          provider: output.provider,
          billing: output.billing ?? null,
        }
        jobProvider = output.provider
      } else {
        const durationSec = typeof sourceVideo.duration_sec === 'number' && Number.isFinite(sourceVideo.duration_sec)
          ? Math.max(1, Math.floor(sourceVideo.duration_sec))
          : 20
        const highlights = await videoAi.extractHighlights({
          aiPlanCode,
          durationSec,
        })
        const shortPlan = await videoAi.generateShortVideo({
          aiPlanCode,
          sourcePath: sourceVideo.storage_path,
          durationSec,
        })

        const highlightPath = buildAiProPlusHighlightPath({
          storeId,
          medicalRecordId: sourceRecord.id,
          sourcePath: sourceVideo.storage_path,
        })

        let highlightMethod: 'ffmpeg' | 'copy' = 'copy'
        const { data: sourceBlob } = await admin.storage.from(VIDEO_STORAGE_BUCKET).download(sourceVideo.storage_path)
        if (sourceBlob) {
          try {
            const clip = await createVideoClipWithFfmpeg({
              sourceBlob,
              outputExt: 'mp4',
              startSec: shortPlan.startSec,
              durationSec: shortPlan.durationSec,
            })
            const { error: uploadError } = await admin.storage
              .from(VIDEO_STORAGE_BUCKET)
              .upload(highlightPath, clip.clipBuffer, {
                contentType: 'video/mp4',
                upsert: true,
              })
            if (!uploadError) {
              highlightMethod = 'ffmpeg'
            } else {
              throw new Error(uploadError.message)
            }
          } catch {
            const { error: copyError } = await admin.storage
              .from(VIDEO_STORAGE_BUCKET)
              .copy(sourceVideo.storage_path, highlightPath)
            if (copyError) throw new Error(copyError.message)
            highlightMethod = 'copy'
          }
        }

        const { data: insertedVideoRaw, error: insertVideoError } = await admin
          .from('medical_record_videos' as never)
          .insert({
            store_id: storeId,
            medical_record_id: sourceRecord.id,
            pet_id: sourceRecord.pet_id,
            storage_path: highlightPath,
            duration_sec: shortPlan.durationSec,
            size_bytes: 0,
            source_type: 'ai_generated',
            comment: 'AI Pro+ 動画AIハイライト',
            sort_order: (typeof sourceVideo.sort_order === 'number' ? sourceVideo.sort_order : 0) + 1000,
            taken_at: sourceVideo.taken_at ?? null,
            updated_at: new Date().toISOString(),
          } as never)
          .select('id')
          .single()
        const insertedVideo = insertedVideoRaw as { id: string } | null

        if (insertVideoError) throw new Error(insertVideoError.message)

        const healthInsight = deriveMedicalRecordAiProPlusHealthInsight({
          aiPlanCode,
          behaviorNotes: sourceRecord.behavior_notes ?? null,
          skinCondition: sourceRecord.skin_condition ?? null,
          tags,
          durationSec,
        })

        const now = new Date().toISOString()
        const { error: healthError } = await admin
          .from('medical_record_ai_pro_plus_health_insights' as never)
          .upsert(
            {
              store_id: storeId,
              medical_record_id: sourceRecord.id,
              gait_risk: healthInsight.gaitRisk,
              skin_risk: healthInsight.skinRisk,
              tremor_risk: healthInsight.tremorRisk,
              respiration_risk: healthInsight.respirationRisk,
              stress_level: healthInsight.stressLevel,
              fatigue_level: healthInsight.fatigueLevel,
              summary: healthInsight.summary,
              confidence: healthInsight.confidence,
              highlight_video_id: insertedVideo?.id ?? null,
              analyzed_at: now,
              updated_at: now,
            } as never,
            { onConflict: 'medical_record_id' }
          )

        if (healthError) throw new Error(healthError.message)

        resultPayload = {
          provider: highlights.provider,
          segments: highlights.segments,
          shortPlan,
          highlightPath,
          highlightVideoId: insertedVideo?.id ?? null,
          highlightMethod,
          healthInsight,
          billing: {
            extractHighlights: highlights.billing ?? null,
            generateShortVideo: shortPlan.billing ?? null,
          },
        }
        jobProvider = highlights.provider
      }

      const completedAt = new Date().toISOString()
      const { error: completeError } = await admin
        .from('medical_record_ai_video_jobs' as never)
        .update({
          status: 'completed',
          provider: jobProvider,
          result_payload: resultPayload,
          error_message: null,
          completed_at: completedAt,
          updated_at: completedAt,
        } as never)
        .eq('id', jobId)

      if (completeError) {
        throw new Error(completeError.message)
      }

      summary.completed += 1
    } catch (error) {
      summary.failed += 1
      await markFailed({
        admin,
        jobId,
        message: error instanceof Error ? error.message : 'AI動画ジョブの処理に失敗しました。',
      })
    }
  }

  return summary
}
