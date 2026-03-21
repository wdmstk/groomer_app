import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { enqueueMedicalRecordVideoAiJob } from '@/lib/medical-records/ai-video-jobs'
import { hasAiProPlusAccess } from '@/lib/medical-records/ai-pro-plus'
import { parseAiPlanCode } from '@/lib/billing/pricing'

type RouteParams = {
  params: Promise<{
    video_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data, error } = await supabase
    .from('medical_record_ai_video_jobs' as never)
    .select('id, tier, status, source, provider, result_payload, error_message, queued_at, started_at, completed_at')
    .eq('store_id', storeId)
    .eq('medical_record_video_id', video_id)
    .eq('tier', 'pro_plus')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ job: data ?? null })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: videoRaw, error: videoError }, { data: subscription }] = await Promise.all([
    supabase
      .from('medical_record_videos' as never)
      .select('id, medical_record_id')
      .eq('id', video_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('store_subscriptions')
      .select('ai_plan_code_effective, ai_plan_code')
      .eq('store_id', storeId)
      .maybeSingle(),
  ])

  if (videoError) {
    return NextResponse.json({ message: videoError.message }, { status: 500 })
  }
  const video = videoRaw as { id?: string | null; medical_record_id?: string | null } | null
  if (!video?.id || !video.medical_record_id) {
    return NextResponse.json({ message: '対象動画が見つかりません。' }, { status: 404 })
  }

  const aiPlanCode = parseAiPlanCode(
    (subscription as { ai_plan_code_effective?: string | null; ai_plan_code?: string | null } | null)
      ?.ai_plan_code_effective ??
      (subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ??
      'none'
  )
  if (!hasAiProPlusAccess(aiPlanCode)) {
    return NextResponse.json({ message: 'AI Pro+の契約が必要です。' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const force = body?.action === 'retry'

  try {
    const job = await enqueueMedicalRecordVideoAiJob({
      supabase,
      storeId,
      medicalRecordId: video.medical_record_id,
      medicalRecordVideoId: video_id,
      requestedByUserId: user?.id ?? null,
      tier: 'pro_plus',
      source: force ? 'retry' : 'manual',
      force,
    })

    return NextResponse.json({
      job,
      message: force ? 'Pro+動画AI処理を再実行キューに追加しました。' : 'Pro+動画AI処理をキューに追加しました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pro+動画AI処理の受付に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
