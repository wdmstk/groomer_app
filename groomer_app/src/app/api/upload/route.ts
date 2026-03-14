import { createStoreScopedClient } from '@/lib/supabase/store'
import { NextResponse } from 'next/server'
import {
  buildMedicalRecordPhotoFolder,
  getMedicalRecordPhotoBucket,
} from '@/lib/medical-records/photos'
import { ensureStoreHasStorageCapacity, formatBytesToJa } from '@/lib/storage-quota'

// Supabaseの型定義をインポート（別途生成）
// import { Database } from '@/types/supabase';
const STORAGE_BUCKET = getMedicalRecordPhotoBucket()

export async function POST(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const requestedFolderPath = formData.get('folderPath')?.toString().trim() ?? ''
  const petId = formData.get('petId')?.toString().trim() ?? ''
  const recordDate = formData.get('recordDate')?.toString().trim() ?? null
  const photoType = formData.get('photoType')?.toString().trim() === 'after' ? 'after' : 'before'
  const sanitizedFolderPath = requestedFolderPath
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '')
  const folderPath =
    petId && recordDate
      ? buildMedicalRecordPhotoFolder({
          storeId,
          petId,
          recordDate,
          photoType,
        })
      : sanitizedFolderPath
        ? `${storeId}/${sanitizedFolderPath}`
        : `${storeId}/${user.id}`

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '画像ファイルのみアップロードできます。' }, { status: 400 });
  }

  const MAX_FILE_SIZE = 8 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'ファイルサイズは8MB以下にしてください。' }, { status: 400 });
  }

  const capacityCheck = await ensureStoreHasStorageCapacity({
    storeId,
    bucket: STORAGE_BUCKET,
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

  const fileExtRaw = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const fileExt = fileExtRaw.replace(/[^a-z0-9]/g, '') || 'bin'
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
  const filePath = `${folderPath}/${fileName}`

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (error) {
      console.error('Supabase Storage upload error:', error)
      if (error.message.includes('Bucket not found')) {
        return NextResponse.json(
          {
            error: `Storageバケット '${STORAGE_BUCKET}' が存在しません。Supabaseにバケットを作成してください。`,
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: signedUrlData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60)

    return NextResponse.json({
      storagePath: filePath,
      signedUrl: signedUrlData?.signedUrl ?? null,
      storageCleanup: {
        cleanedUpCount: capacityCheck.cleanedUpCount,
        freedBytes: capacityCheck.freedBytes,
      },
    })
  } catch (error: unknown) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
