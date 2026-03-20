import { createStoreScopedClient } from '@/lib/supabase/store'
import { NextResponse } from 'next/server'
import { getMedicalRecordPhotoBucket } from '@/lib/medical-records/photos'
import {
  buildMedicalRecordVideoFolder,
  getMedicalRecordVideoBucket,
} from '@/lib/medical-records/videos'
import { ensureStoreHasStorageCapacity, formatBytesToJa } from '@/lib/storage-quota'

const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()
const PHOTO_STORAGE_BUCKET = getMedicalRecordPhotoBucket()

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const requestedFolderPath = formData.get('folderPath')?.toString().trim() ?? ''
  const petId = formData.get('petId')?.toString().trim() ?? ''
  const recordDate = formData.get('recordDate')?.toString().trim() ?? null
  const sanitizedFolderPath = requestedFolderPath
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '')
  const folderPath =
    petId && recordDate
      ? buildMedicalRecordVideoFolder({
          storeId,
          petId,
          recordDate,
        })
      : sanitizedFolderPath
        ? `${storeId}/${sanitizedFolderPath}`
        : `${storeId}/${user.id}`

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!file.type.startsWith('video/')) {
    return NextResponse.json({ error: '動画ファイルのみアップロードできます。' }, { status: 400 })
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'ファイルサイズは50MB以下にしてください。' }, { status: 400 })
  }

  const capacityCheck = await ensureStoreHasStorageCapacity({
    storeId,
    bucket: VIDEO_STORAGE_BUCKET,
    buckets: [PHOTO_STORAGE_BUCKET, VIDEO_STORAGE_BUCKET],
    incomingBytes: file.size,
  })
  if (!capacityCheck.allowed) {
    const remainBytes = Math.max(0, capacityCheck.quota.totalLimitBytes - capacityCheck.quota.usageBytes)
    const policyLabel =
      capacityCheck.quota.policy === 'cleanup_orphans' ? '孤立ファイル整理' : '追加登録停止'
    return NextResponse.json(
      {
        error: `容量上限を超えるためアップロードできません。現在 ${formatBytesToJa(capacityCheck.quota.usageBytes)} / 上限 ${formatBytesToJa(capacityCheck.quota.totalLimitBytes)}（方針: ${policyLabel}）。残り ${formatBytesToJa(remainBytes)} です。`,
      },
      { status: 409 }
    )
  }

  const fileExtRaw = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const fileExt = fileExtRaw.replace(/[^a-z0-9]/g, '') || 'mp4'
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
  const filePath = `${folderPath}/${fileName}`

  try {
    const { error } = await supabase.storage.from(VIDEO_STORAGE_BUCKET).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

    if (error) {
      console.error('Supabase Storage video upload error:', error)
      if (error.message.includes('Bucket not found')) {
        return NextResponse.json(
          {
            error: `Storageバケット '${VIDEO_STORAGE_BUCKET}' が存在しません。Supabaseにバケットを作成してください。`,
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: signedUrlData } = await supabase.storage
      .from(VIDEO_STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60)

    return NextResponse.json({
      storagePath: filePath,
      signedUrl: signedUrlData?.signedUrl ?? null,
      bucket: VIDEO_STORAGE_BUCKET,
      storageCleanup: {
        cleanedUpCount: capacityCheck.cleanedUpCount,
        freedBytes: capacityCheck.freedBytes,
      },
    })
  } catch (error: unknown) {
    console.error('Video upload error:', error)
    return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 })
  }
}
