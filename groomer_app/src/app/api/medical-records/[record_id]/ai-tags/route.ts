import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { enqueueMedicalRecordAiTagJob, runMedicalRecordAiTagJob } from '@/lib/medical-records/ai-tags'
import { parseMedicalRecordAiJobPayload } from '@/lib/medical-records/tags'

type RouteParams = {
  params: Promise<{
    record_id: string
  }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { record_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: record, error: recordError } = await supabase
    .from('medical_records')
    .select('id, store_id')
    .eq('id', record_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (recordError) {
    return NextResponse.json({ message: recordError.message }, { status: 500 })
  }
  if (!record) {
    return NextResponse.json({ message: '対象カルテが見つかりません。' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const payload = parseMedicalRecordAiJobPayload(body)
  const force = payload?.action === 'retry'

  try {
    const job = await enqueueMedicalRecordAiTagJob({
      supabase,
      storeId,
      medicalRecordId: record_id,
      requestedByUserId: user?.id ?? null,
      source: force ? 'retry' : 'manual',
      force,
    })
    await runMedicalRecordAiTagJob({ jobId: job.id, limit: 1 })

    return NextResponse.json({
      job,
      message: force ? 'AIタグ再解析を受け付けました。' : 'AIタグ解析を受け付けました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AIタグ解析の受付に失敗しました。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
