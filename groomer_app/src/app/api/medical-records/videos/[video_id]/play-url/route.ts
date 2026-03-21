import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { getMedicalRecordVideoBucket } from '@/lib/medical-records/videos'

type RouteParams = {
  params: Promise<{
    video_id: string
  }>
}

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()

export async function GET(request: Request, { params }: RouteParams) {
  const { video_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { searchParams } = new URL(request.url)
  const expiresInRaw = Number(searchParams.get('expires_in') ?? '3600')
  const expiresIn = Number.isFinite(expiresInRaw) ? Math.min(60 * 60 * 6, Math.max(60, Math.floor(expiresInRaw))) : 3600

  const { data: rawRow, error } = await supabase
    .from('medical_record_videos' as never)
    .select('id, storage_path')
    .eq('id', video_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  const row = rawRow as { id: string; storage_path: string } | null
  if (!row?.storage_path) {
    return NextResponse.json({ message: 'Video not found.' }, { status: 404 })
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(VIDEO_STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, expiresIn)

  if (signedUrlError) {
    return NextResponse.json({ message: signedUrlError.message }, { status: 500 })
  }

  return NextResponse.json({
    videoId: row.id,
    storagePath: row.storage_path,
    signedUrl: data?.signedUrl ?? null,
    expiresIn,
  })
}
