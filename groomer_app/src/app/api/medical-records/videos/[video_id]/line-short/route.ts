import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  buildMedicalRecordLineShortVideoPath,
  getMedicalRecordVideoBucket,
} from '@/lib/medical-records/videos'

type RouteParams = {
  params: Promise<{
    video_id: string
  }>
}

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()
const MIN_LINE_SHORT_DURATION_SEC = 10
const MAX_LINE_SHORT_DURATION_SEC = 20

export async function POST(_request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: row, error } = await supabase
    .from('medical_record_videos' as never)
    .select('id, medical_record_id, storage_path, line_short_path, duration_sec')
    .eq('id', video_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  if (!row?.storage_path) {
    return NextResponse.json({ message: 'Video not found.' }, { status: 404 })
  }

  const durationSec =
    typeof row.duration_sec === 'number' && Number.isFinite(row.duration_sec)
      ? Math.max(0, Math.floor(row.duration_sec))
      : null
  if (
    durationSec === null ||
    durationSec < MIN_LINE_SHORT_DURATION_SEC ||
    durationSec > MAX_LINE_SHORT_DURATION_SEC
  ) {
    return NextResponse.json(
      {
        message: `LINE送信用は${MIN_LINE_SHORT_DURATION_SEC}〜${MAX_LINE_SHORT_DURATION_SEC}秒の動画のみ対応です。`,
      },
      { status: 400 }
    )
  }

  if (typeof row.line_short_path === 'string' && row.line_short_path.length > 0) {
    return NextResponse.json({
      videoId: row.id,
      lineShortPath: row.line_short_path,
      durationSec,
      reused: true,
    })
  }

  const lineShortPath = buildMedicalRecordLineShortVideoPath({
    storeId,
    medicalRecordId: row.medical_record_id,
    sourcePath: row.storage_path,
  })

  const { error: copyError } = await supabase.storage
    .from(VIDEO_STORAGE_BUCKET)
    .copy(row.storage_path, lineShortPath)

  if (copyError) {
    return NextResponse.json({ message: copyError.message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('medical_record_videos' as never)
    .update({
      line_short_path: lineShortPath,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id)
    .eq('store_id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    videoId: row.id,
    lineShortPath,
    durationSec,
    reused: false,
  })
}
