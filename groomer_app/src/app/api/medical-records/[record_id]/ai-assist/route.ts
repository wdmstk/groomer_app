import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  enqueueMedicalRecordAiAssistJob,
  hasAiAssistAccess,
} from '@/lib/medical-records/ai-assist'
import { parseAiPlanCode } from '@/lib/billing/pricing'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const [{ data: latestJob, error: jobError }, { data: latestResult, error: resultError }] = await Promise.all([
    supabase
      .from('medical_record_ai_assist_jobs' as never)
      .select('id, status, error_message, source, provider, queued_at, started_at, completed_at')
      .eq('store_id', storeId)
      .eq('medical_record_id', record_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('medical_record_ai_assist_results' as never)
      .select('generated_tags, generated_record_text, generated_short_video_path, generated_video_id, generated_at, provider')
      .eq('store_id', storeId)
      .eq('medical_record_id', record_id)
      .maybeSingle(),
  ])

  if (jobError) return NextResponse.json({ message: jobError.message }, { status: 500 })
  if (resultError) return NextResponse.json({ message: resultError.message }, { status: 500 })

  return NextResponse.json({
    job: latestJob ?? null,
    result: latestResult ?? null,
  })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: record, error: recordError }, { data: subscription }] = await Promise.all([
    supabase
      .from('medical_records')
      .select('id')
      .eq('id', record_id)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('store_subscriptions')
      .select('ai_plan_code_effective, ai_plan_code')
      .eq('store_id', storeId)
      .maybeSingle(),
  ])
  if (recordError) {
    return NextResponse.json({ message: recordError.message }, { status: 500 })
  }
  if (!record?.id) {
    return NextResponse.json({ message: '対象カルテが見つかりません。' }, { status: 404 })
  }

  const aiPlanCode = parseAiPlanCode(
    (subscription as { ai_plan_code_effective?: string | null; ai_plan_code?: string | null } | null)
      ?.ai_plan_code_effective ??
      (subscription as { ai_plan_code?: string | null } | null)?.ai_plan_code ??
      'none'
  )
  if (!hasAiAssistAccess(aiPlanCode)) {
    return NextResponse.json({ message: 'AI Assist以上の契約が必要です。' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const force = body?.action === 'retry'

  try {
    const job = await enqueueMedicalRecordAiAssistJob({
      supabase,
      storeId,
      medicalRecordId: record_id,
      requestedByUserId: user?.id ?? null,
      source: force ? 'retry' : 'manual',
      force,
    })
    return NextResponse.json({
      job,
      message: force ? 'AI Assist再解析を受け付けました。' : 'AI Assist解析を受け付けました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI Assist解析の受付に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
