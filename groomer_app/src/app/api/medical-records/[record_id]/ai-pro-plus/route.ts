import { NextResponse } from 'next/server'
import { parseAiPlanCode } from '@/lib/billing/pricing'
import { getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'
import {
  buildAiProPlusHighlightPath,
  deriveMedicalRecordAiProPlusHealthInsight,
  hasAiProPlusAccess,
} from '@/lib/medical-records/ai-pro-plus'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()

const HEALTH_INSIGHT_SELECT =
  'id, medical_record_id, gait_risk, skin_risk, tremor_risk, respiration_risk, stress_level, fatigue_level, summary, confidence, analyzed_at, highlight_video_id'

export async function GET(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data, error } = await supabase
    .from('medical_record_ai_pro_plus_health_insights' as never)
    .select(HEALTH_INSIGHT_SELECT)
    .eq('medical_record_id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    insight: data ?? null,
  })
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: subscription } = await supabase
    .from('store_subscriptions')
    .select('ai_plan_code')
    .eq('store_id', storeId)
    .maybeSingle()
  const aiPlanCode = parseAiPlanCode((subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ?? 'none')
  if (!hasAiProPlusAccess(aiPlanCode)) {
    return NextResponse.json({ message: 'AI Pro+の契約が必要です。' }, { status: 403 })
  }

  const { data: record, error: recordError } = await supabase
    .from('medical_records')
    .select('id, pet_id, appointment_id, behavior_notes, skin_condition, tags')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()
  if (recordError) {
    return NextResponse.json({ message: recordError.message }, { status: 500 })
  }
  if (!record?.id || !record.pet_id) {
    return NextResponse.json({ message: 'カルテが見つかりません。' }, { status: 404 })
  }

  const { data: sourceVideo } = await supabase
    .from('medical_record_videos' as never)
    .select('id, storage_path, duration_sec, taken_at, sort_order')
    .eq('medical_record_id', record.id)
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const insight = deriveMedicalRecordAiProPlusHealthInsight({
    aiPlanCode,
    behaviorNotes: record.behavior_notes ?? null,
    skinCondition: record.skin_condition ?? null,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : null,
    durationSec:
      typeof sourceVideo?.duration_sec === 'number' && Number.isFinite(sourceVideo.duration_sec)
        ? sourceVideo.duration_sec
        : null,
  })

  let highlightVideoId: string | null = null
  let generatedHighlight = false
  if (sourceVideo?.storage_path) {
    const highlightPath = buildAiProPlusHighlightPath({
      storeId,
      medicalRecordId: record.id,
      sourcePath: sourceVideo.storage_path,
    })
    const { error: copyError } = await supabase.storage
      .from(VIDEO_STORAGE_BUCKET)
      .copy(sourceVideo.storage_path, highlightPath)

    if (!copyError) {
      const { data: insertedHighlight } = await supabase
        .from('medical_record_videos' as never)
        .insert({
          store_id: storeId,
          medical_record_id: record.id,
          pet_id: record.pet_id,
          appointment_id: record.appointment_id,
          storage_path: highlightPath,
          duration_sec:
            typeof sourceVideo.duration_sec === 'number' && Number.isFinite(sourceVideo.duration_sec)
              ? Math.max(5, Math.min(30, Math.floor(sourceVideo.duration_sec)))
              : null,
          size_bytes: 0,
          source_type: 'ai_generated',
          comment: 'AI Pro+ 教育ハイライト',
          sort_order: (sourceVideo.sort_order ?? 0) + 1000,
          taken_at: sourceVideo.taken_at ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .select('id')
        .single()
      if (insertedHighlight?.id) {
        highlightVideoId = insertedHighlight.id as string
        generatedHighlight = true
      }
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('medical_record_ai_pro_plus_health_insights' as never)
    .upsert(
      {
        store_id: storeId,
        medical_record_id: record.id,
        gait_risk: insight.gaitRisk,
        skin_risk: insight.skinRisk,
        tremor_risk: insight.tremorRisk,
        respiration_risk: insight.respirationRisk,
        stress_level: insight.stressLevel,
        fatigue_level: insight.fatigueLevel,
        summary: insight.summary,
        confidence: insight.confidence,
        highlight_video_id: highlightVideoId,
        analyzed_at: now,
        updated_at: now,
      } as never,
      { onConflict: 'medical_record_id' }
    )
    .select(HEALTH_INSIGHT_SELECT)
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    generatedHighlight,
    insight: data,
  })
}

