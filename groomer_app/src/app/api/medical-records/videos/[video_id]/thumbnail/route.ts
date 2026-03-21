import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  buildMedicalRecordVideoThumbnailPath,
  getMedicalRecordVideoBucket,
} from '@/lib/medical-records/videos'

type RouteParams = {
  params: Promise<{
    video_id: string
  }>
}

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()

export async function POST(_request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: rawRow, error } = await supabase
    .from('medical_record_videos' as never)
    .select('id, medical_record_id, storage_path, thumbnail_path')
    .eq('id', video_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  const row = rawRow as {
    id: string
    medical_record_id: string
    storage_path: string
    thumbnail_path: string | null
  } | null
  if (!row?.storage_path) {
    return NextResponse.json({ message: 'Video not found.' }, { status: 404 })
  }

  if (row.thumbnail_path) {
    return NextResponse.json({
      videoId: row.id,
      thumbnailPath: row.thumbnail_path,
      reused: true,
    })
  }

  const thumbnailPath = buildMedicalRecordVideoThumbnailPath({
    storeId,
    medicalRecordId: row.medical_record_id,
    sourcePath: row.storage_path,
  })

  const { error: copyError } = await supabase.storage
    .from(VIDEO_STORAGE_BUCKET)
    .copy(row.storage_path, thumbnailPath)

  if (copyError) {
    return NextResponse.json({ message: copyError.message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('medical_record_videos' as never)
    .update({
      thumbnail_path: thumbnailPath,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id)
    .eq('store_id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    videoId: row.id,
    thumbnailPath,
    reused: false,
  })
}
