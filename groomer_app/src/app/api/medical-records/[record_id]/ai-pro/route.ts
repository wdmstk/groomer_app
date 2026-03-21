import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  deriveMedicalRecordAiProInsight,
  hasAiProAccess,
} from '@/lib/medical-records/ai-pro'
import { parseAiPlanCode } from '@/lib/billing/pricing'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

const INSIGHT_SELECT =
  'id, medical_record_id, model_tier, personality_traits, behavior_score, cooperation_score, stress_score, estimated_next_duration_min, matting_risk, surcharge_risk, highlighted_scenes, confidence, source_video_count, analyzed_at'

export async function GET(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: record } = await supabase
    .from('medical_records')
    .select('id')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!record?.id) {
    return NextResponse.json({ message: 'カルテが見つかりません。' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('medical_record_ai_pro_insights' as never)
    .select(INSIGHT_SELECT)
    .eq('medical_record_id', record_id)
    .eq('store_id', storeId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
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
    .select('ai_plan_code_effective, ai_plan_code')
    .eq('store_id', storeId)
    .maybeSingle()
  const aiPlanCode = parseAiPlanCode(
    (subscription as { ai_plan_code_effective?: string | null; ai_plan_code?: string | null } | null)
      ?.ai_plan_code_effective ??
      (subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ??
      'none'
  )
  if (!hasAiProAccess(aiPlanCode)) {
    return NextResponse.json({ message: 'AI Pro以上の契約が必要です。' }, { status: 403 })
  }

  const { data: record, error: recordError } = await supabase
    .from('medical_records')
    .select('id, duration, behavior_notes, skin_condition, tags')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()
  if (recordError) {
    return NextResponse.json({ message: recordError.message }, { status: 500 })
  }
  if (!record?.id) {
    return NextResponse.json({ message: 'カルテが見つかりません。' }, { status: 404 })
  }

  const { count: videoCount } = await supabase
    .from('medical_record_videos' as never)
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('medical_record_id', record.id)

  const insight = deriveMedicalRecordAiProInsight({
    aiPlanCode,
    durationMin: typeof record.duration === 'number' && Number.isFinite(record.duration) ? record.duration : null,
    behaviorNotes: record.behavior_notes ?? null,
    skinCondition: record.skin_condition ?? null,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : null,
    videoCount: videoCount ?? 0,
  })

  const analyzedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('medical_record_ai_pro_insights' as never)
    .upsert(
      {
        store_id: storeId,
        medical_record_id: record.id,
        model_tier: insight.modelTier,
        personality_traits: insight.personalityTraits,
        behavior_score: insight.behaviorScore,
        cooperation_score: insight.cooperationScore,
        stress_score: insight.stressScore,
        estimated_next_duration_min: insight.estimatedNextDurationMin,
        matting_risk: insight.mattingRisk,
        surcharge_risk: insight.surchargeRisk,
        highlighted_scenes: insight.highlightedScenes,
        confidence: insight.confidence,
        source_video_count: insight.sourceVideoCount,
        analyzed_at: analyzedAt,
        updated_at: analyzedAt,
      } as never,
      { onConflict: 'medical_record_id' }
    )
    .select(INSIGHT_SELECT)
    .single()
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    insight: data,
  })
}
