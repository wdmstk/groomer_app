import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import type { MedicalRecordSupabaseClient } from '@/lib/medical-records/services/shared'
import {
  AI_TAG_PROVIDER,
  inferMedicalRecordTags,
  parseMedicalRecordTags,
} from '@/lib/medical-records/tags'

type AiTagJobRow = Database['public']['Tables']['medical_record_ai_tag_jobs']['Row']

export async function enqueueMedicalRecordAiTagJob(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  medicalRecordId: string
  requestedByUserId?: string | null
  source?: 'manual' | 'record_saved' | 'retry'
  force?: boolean
}) {
  const { supabase, storeId, medicalRecordId } = params
  const source = params.source ?? 'manual'

  if (!params.force) {
    const { data: existingJob } = await supabase
      .from('medical_record_ai_tag_jobs')
      .select('id, status')
      .eq('store_id', storeId)
      .eq('medical_record_id', medicalRecordId)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (existingJob) {
      return existingJob
    }
  }

  const { data: createdJob, error } = await supabase
    .from('medical_record_ai_tag_jobs')
    .insert({
      store_id: storeId,
      medical_record_id: medicalRecordId,
      requested_by_user_id: params.requestedByUserId ?? null,
      source,
      provider: AI_TAG_PROVIDER,
      status: 'queued',
    })
    .select('id, status')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await supabase
    .from('medical_records')
    .update({
      ai_tag_status: 'queued',
      ai_tag_error: null,
      ai_tag_source: AI_TAG_PROVIDER,
    })
    .eq('id', medicalRecordId)
    .eq('store_id', storeId)

  return createdJob
}

async function markJobFailed(admin: ReturnType<typeof createAdminSupabaseClient>, job: AiTagJobRow, message: string) {
  await Promise.all([
    admin
      .from('medical_record_ai_tag_jobs')
      .update({
        status: 'failed',
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id),
    admin
      .from('medical_records')
      .update({
        ai_tag_status: 'failed',
        ai_tag_error: message,
        ai_tag_source: AI_TAG_PROVIDER,
      })
      .eq('id', job.medical_record_id)
      .eq('store_id', job.store_id),
  ])
}

async function processMedicalRecordAiTagJob(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  job: AiTagJobRow
) {
  const startedAt = new Date().toISOString()
  const { error: startError } = await admin
    .from('medical_record_ai_tag_jobs')
    .update({
      status: 'processing',
      started_at: startedAt,
      attempts: job.attempts + 1,
      updated_at: startedAt,
    })
    .eq('id', job.id)
    .eq('status', 'queued')

  if (startError) {
    throw new Error(startError.message)
  }

  await admin
    .from('medical_records')
    .update({
      ai_tag_status: 'processing',
      ai_tag_error: null,
      ai_tag_source: AI_TAG_PROVIDER,
    })
    .eq('id', job.medical_record_id)
    .eq('store_id', job.store_id)

  const [{ data: record, error: recordError }, { data: photos, error: photoError }] = await Promise.all([
    admin
      .from('medical_records')
      .select('id, store_id, skin_condition, behavior_notes, caution_notes, tags')
      .eq('id', job.medical_record_id)
      .eq('store_id', job.store_id)
      .maybeSingle(),
    admin
      .from('medical_record_photos')
      .select('comment, photo_type')
      .eq('medical_record_id', job.medical_record_id)
      .eq('store_id', job.store_id)
      .order('sort_order', { ascending: true }),
  ])

  if (recordError) {
    throw new Error(recordError.message)
  }
  if (photoError) {
    throw new Error(photoError.message)
  }
  if (!record) {
    throw new Error('対象カルテが見つかりません。')
  }

  const inferredTags = inferMedicalRecordTags({
    skinCondition: record.skin_condition,
    behaviorNotes: record.behavior_notes,
    cautionNotes: record.caution_notes,
    photoComments: (photos ?? []).map((photo) => photo.comment ?? '').filter(Boolean),
  })
  const mergedTags = Array.from(
    new Set([
      ...(parseMedicalRecordTags(record.tags) ?? []),
      ...inferredTags,
    ])
  )
  const completedAt = new Date().toISOString()

  const [{ error: recordUpdateError }, { error: jobUpdateError }] = await Promise.all([
    admin
      .from('medical_records')
      .update({
        tags: mergedTags,
        ai_tag_status: 'completed',
        ai_tag_error: null,
        ai_tag_last_analyzed_at: completedAt,
        ai_tag_source: AI_TAG_PROVIDER,
      })
      .eq('id', job.medical_record_id)
      .eq('store_id', job.store_id),
    admin
      .from('medical_record_ai_tag_jobs')
      .update({
        status: 'completed',
        result_tags: mergedTags,
        error_message: null,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', job.id),
  ])

  if (recordUpdateError) {
    throw new Error(recordUpdateError.message)
  }
  if (jobUpdateError) {
    throw new Error(jobUpdateError.message)
  }

  return {
    jobId: job.id,
    medicalRecordId: job.medical_record_id,
    tags: mergedTags,
    provider: AI_TAG_PROVIDER,
  }
}

export async function runMedicalRecordAiTagJob(params?: { limit?: number; jobId?: string }) {
  const admin = createAdminSupabaseClient()
  const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50)
  let query = admin
    .from('medical_record_ai_tag_jobs')
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

  if (error) {
    throw new Error(error.message)
  }

  const summary = {
    scanned: jobs?.length ?? 0,
    completed: 0,
    failed: 0,
  }

  for (const job of jobs ?? []) {
    try {
      await processMedicalRecordAiTagJob(admin, job)
      summary.completed += 1
    } catch (error) {
      summary.failed += 1
      await markJobFailed(admin, job, error instanceof Error ? error.message : 'AIタグ解析に失敗しました。')
    }
  }

  return summary
}
