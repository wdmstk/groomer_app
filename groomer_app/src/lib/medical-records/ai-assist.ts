import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { MedicalRecordSupabaseClient } from '@/lib/medical-records/services/shared'
import { parseAiPlanCode } from '@/lib/billing/pricing'
import { buildMedicalRecordLineShortVideoPath, getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'
import { isObjectRecord } from '@/lib/object-utils'

type AiAssistJobSource = 'manual' | 'record_saved' | 'retry'
type AiAssistJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'

export function hasAiAssistAccess(value: unknown): boolean {
  return parseAiPlanCode(value) !== 'none'
}

function asObject(value: unknown): { [key: string]: unknown } | null {
  if (!isObjectRecord(value)) return null
  return value
}

export async function enqueueMedicalRecordAiAssistJob(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  medicalRecordId: string
  requestedByUserId?: string | null
  source?: AiAssistJobSource
  force?: boolean
}) {
  const source = params.source ?? 'manual'
  const { supabase, storeId, medicalRecordId } = params

  if (!params.force) {
    const { data: existing } = await supabase
      .from('medical_record_ai_assist_jobs' as never)
      .select('id, status')
      .eq('store_id', storeId)
      .eq('medical_record_id', medicalRecordId)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (existing) {
      return existing as { id: string; status: AiAssistJobStatus }
    }
  }

  const { data, error } = await supabase
    .from('medical_record_ai_assist_jobs' as never)
    .insert({
      store_id: storeId,
      medical_record_id: medicalRecordId,
      requested_by_user_id: params.requestedByUserId ?? null,
      source,
      status: 'queued',
    } as never)
    .select('id, status')
    .single()

  if (error) throw new Error(error.message)
  return data as { id: string; status: AiAssistJobStatus }
}

export function deriveAssistTags(params: {
  skinCondition: string | null
  behaviorNotes: string | null
  menu: string | null
  photoComments: string[]
}) {
  const sourceText = [
    params.skinCondition ?? '',
    params.behaviorNotes ?? '',
    params.menu ?? '',
    ...params.photoComments,
  ].join(' ')
  const tags = new Set<string>()
  if (sourceText.includes('毛玉')) tags.add('毛玉')
  if (sourceText.includes('皮膚') || sourceText.includes('赤み') || sourceText.includes('乾燥')) tags.add('皮膚')
  if (sourceText.includes('耳')) tags.add('耳汚れ')
  if (params.menu?.trim()) tags.add('施術内容')
  if (tags.size === 0) tags.add('施術内容')
  return Array.from(tags)
}

export function deriveRecordSummary(params: {
  menu: string | null
  duration: number | null
  skinCondition: string | null
  behaviorNotes: string | null
  tags: string[]
}) {
  const durationText =
    typeof params.duration === 'number' && Number.isFinite(params.duration) && params.duration > 0
      ? `${Math.floor(params.duration)}分`
      : '所要時間未登録'
  const menu = params.menu?.trim() || '施術内容未登録'
  const skin = params.skinCondition?.trim() || '皮膚状態は安定'
  const behavior = params.behaviorNotes?.trim() || '落ち着いて施術できました'
  const tagText = params.tags.join('・')
  return `本日は${menu}を実施しました。${durationText}で完了し、${skin}。${behavior}。AI記録タグ: ${tagText}。`
}

async function copyLineShortVideo(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
  medicalRecordId: string
}) {
  const { admin, storeId, medicalRecordId } = params
  const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()
  const { data: sourceVideoRaw } = await admin
    .from('medical_record_videos' as never)
    .select('id, pet_id, appointment_id, storage_path, duration_sec, sort_order, taken_at')
    .eq('store_id', storeId)
    .eq('medical_record_id', medicalRecordId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const sourceVideo = sourceVideoRaw as {
    id: string
    pet_id: string | null
    appointment_id: string | null
    storage_path: string | null
    duration_sec: number | null
    sort_order: number | null
    taken_at: string | null
  } | null

  if (!sourceVideo?.storage_path) {
    return { generatedVideoId: null as string | null, generatedStoragePath: null as string | null }
  }

  const generatedStoragePath = buildMedicalRecordLineShortVideoPath({
    storeId,
    medicalRecordId,
    sourcePath: sourceVideo.storage_path as string,
  })
  const { error: copyError } = await admin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .copy(sourceVideo.storage_path as string, generatedStoragePath)

  if (copyError) {
    return { generatedVideoId: null, generatedStoragePath: null }
  }

  const { data: insertedRaw } = await admin
    .from('medical_record_videos' as never)
    .insert({
      store_id: storeId,
      medical_record_id: medicalRecordId,
      pet_id: sourceVideo.pet_id,
      appointment_id: sourceVideo.appointment_id,
      storage_path: generatedStoragePath,
      duration_sec:
        typeof sourceVideo.duration_sec === 'number' && Number.isFinite(sourceVideo.duration_sec)
          ? Math.max(10, Math.min(20, Math.floor(sourceVideo.duration_sec)))
          : 15,
      size_bytes: 0,
      source_type: 'ai_generated',
      comment: 'AI Assist ショート動画',
      sort_order: (sourceVideo.sort_order as number | null ?? 0) + 100,
      taken_at: sourceVideo.taken_at as string | null,
      updated_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()
  const inserted = insertedRaw as { id: string } | null

  return {
    generatedVideoId: (inserted?.id as string | undefined) ?? null,
    generatedStoragePath,
  }
}

async function markJobFailed(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  jobId: string
  message: string
}) {
  const { admin, jobId, message } = params
  const now = new Date().toISOString()
  await admin
    .from('medical_record_ai_assist_jobs' as never)
    .update({
      status: 'failed',
      error_message: message,
      completed_at: now,
      updated_at: now,
    } as never)
    .eq('id', jobId)
}

export async function runMedicalRecordAiAssistJob(params?: { limit?: number; jobId?: string }) {
  const admin = createAdminSupabaseClient()
  const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50)

  let query = admin
    .from('medical_record_ai_assist_jobs' as never)
    .select('*')
    .eq('status', 'queued')

  if (params?.jobId) {
    query = query.eq('id', params.jobId)
  } else {
    query = query
      .order('queued_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit)
  }

  const { data: jobs, error } = await query
  if (error) throw new Error(error.message)

  const summary = {
    scanned: (jobs as unknown[] | null)?.length ?? 0,
    completed: 0,
    failed: 0,
  }

  for (const item of (jobs as unknown[] | null) ?? []) {
    const rawJob = asObject(item)
    if (!rawJob) continue
    const jobId = String(rawJob.id ?? '')
    const storeId = String(rawJob.store_id ?? '')
    const medicalRecordId = String(rawJob.medical_record_id ?? '')
    const attempts = Number(rawJob.attempts ?? 0)
    if (!jobId || !storeId || !medicalRecordId) continue

    const startedAt = new Date().toISOString()
    const { error: startError } = await admin
      .from('medical_record_ai_assist_jobs' as never)
      .update({
        status: 'processing',
        started_at: startedAt,
        attempts: attempts + 1,
        updated_at: startedAt,
      } as never)
      .eq('id', jobId)
      .eq('status', 'queued')
    if (startError) {
      summary.failed += 1
      await markJobFailed({ admin, jobId, message: startError.message })
      continue
    }

    try {
      const [{ data: record, error: recordError }, { data: photos, error: photoError }] = await Promise.all([
        admin
          .from('medical_records')
          .select('id, menu, duration, skin_condition, behavior_notes, caution_notes, tags')
          .eq('id', medicalRecordId)
          .eq('store_id', storeId)
          .maybeSingle(),
        admin
          .from('medical_record_photos')
          .select('comment')
          .eq('medical_record_id', medicalRecordId)
          .eq('store_id', storeId)
          .order('sort_order', { ascending: true }),
      ])
      if (recordError) throw new Error(recordError.message)
      if (photoError) throw new Error(photoError.message)
      if (!record?.id) throw new Error('対象カルテが見つかりません。')

      const generatedTags = deriveAssistTags({
        skinCondition: (record.skin_condition as string | null) ?? null,
        behaviorNotes: (record.behavior_notes as string | null) ?? null,
        menu: (record.menu as string | null) ?? null,
        photoComments: ((photos as Array<{ comment: string | null }> | null) ?? [])
          .map((photo) => photo.comment ?? '')
          .filter(Boolean),
      })
      const generatedRecordText = deriveRecordSummary({
        menu: (record.menu as string | null) ?? null,
        duration: (record.duration as number | null) ?? null,
        skinCondition: (record.skin_condition as string | null) ?? null,
        behaviorNotes: (record.behavior_notes as string | null) ?? null,
        tags: generatedTags,
      })

      const lineShort = await copyLineShortVideo({ admin, storeId, medicalRecordId })
      const completedAt = new Date().toISOString()

      const [{ error: resultError }, { error: completeError }] = await Promise.all([
        admin
          .from('medical_record_ai_assist_results' as never)
          .upsert(
            {
              store_id: storeId,
              medical_record_id: medicalRecordId,
              generated_tags: generatedTags,
              generated_record_text: generatedRecordText,
              generated_short_video_path: lineShort.generatedStoragePath,
              generated_video_id: lineShort.generatedVideoId,
              provider: 'assist_light_v1',
              updated_at: completedAt,
              generated_at: completedAt,
            } as never,
            { onConflict: 'medical_record_id' }
          ),
        admin
          .from('medical_record_ai_assist_jobs' as never)
          .update({
            status: 'completed',
            result_payload: {
              generatedTags,
              generatedRecordText,
              generatedShortVideoPath: lineShort.generatedStoragePath,
              generatedVideoId: lineShort.generatedVideoId,
            },
            error_message: null,
            completed_at: completedAt,
            updated_at: completedAt,
          } as never)
          .eq('id', jobId),
      ])

      if (resultError) throw new Error(resultError.message)
      if (completeError) throw new Error(completeError.message)
      summary.completed += 1
    } catch (error) {
      summary.failed += 1
      await markJobFailed({
        admin,
        jobId,
        message: error instanceof Error ? error.message : 'AI Assist解析に失敗しました。',
      })
    }
  }

  return summary
}
