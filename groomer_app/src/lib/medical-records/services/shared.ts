import type { createStoreScopedClient } from '@/lib/supabase/store'
import type { MedicalRecordPhotoDraft } from '@/lib/medical-records/photos'
import { getMedicalRecordPhotoBucket } from '@/lib/medical-records/photos'
import { parseMedicalRecordTags, type MedicalRecordAiTagStatus } from '@/lib/medical-records/tags'
import type { MedicalRecordVideoDraft } from '@/lib/medical-records/videos'
import {
  buildMedicalRecordVideoThumbnailPath,
  getMedicalRecordVideoBucket,
} from '@/lib/medical-records/videos'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

export class MedicalRecordServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'MedicalRecordServiceError'
    this.status = status
  }
}

export type RecordStatus = 'draft' | 'finalized'

export type MedicalRecordSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export type MedicalRecordWriteInput = {
  petId: string | null
  staffId: string | null
  appointmentId: string | null
  requestedPaymentId: string | null
  status: RecordStatus
  recordDate: string | null
  menu: string | null
  duration: number | null
  shampooUsed: string | null
  skinCondition: string | null
  behaviorNotes: string | null
  cautionNotes: string | null
  tags: string[] | null
  photoDrafts: MedicalRecordPhotoDraft[]
  videoDrafts: MedicalRecordVideoDraft[]
}

export type MedicalRecordAiState = {
  aiTagStatus: MedicalRecordAiTagStatus
  aiTagError: string | null
  aiTagLastAnalyzedAt: string | null
  aiTagSource: string | null
}

export function normalizeStatus(value: string | null | undefined): RecordStatus {
  return value === 'finalized' ? 'finalized' : 'draft'
}

export function validateMedicalRecordWriteInput(input: MedicalRecordWriteInput) {
  if (!input.petId) throw new MedicalRecordServiceError('ペットの選択は必須です。')
  if (!input.staffId) throw new MedicalRecordServiceError('担当スタッフの選択は必須です。')
  if (!input.appointmentId) throw new MedicalRecordServiceError('予約の選択は必須です。')
  if (!input.recordDate) throw new MedicalRecordServiceError('施術日時は必須です。')
  if (!input.menu) throw new MedicalRecordServiceError('施術メニューは必須です。')
}

export function normalizeMedicalRecordTagsInput(value: string | string[] | null | undefined) {
  return parseMedicalRecordTags(value)
}

export async function resolvePaymentLink(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  appointmentId: string,
  requestedPaymentId: string | null
) {
  if (requestedPaymentId) {
    const paymentCheck = await supabase
      .from('payments')
      .select('id, appointment_id')
      .eq('id', requestedPaymentId)
      .eq('store_id', storeId)
      .maybeSingle()
    return { paymentId: requestedPaymentId, paymentCheck, candidateCount: 0 as number }
  }

  const { data: paymentCandidates, error } = await supabase
    .from('payments')
    .select('id, appointment_id')
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return {
      paymentId: null,
      paymentCheck: { data: null, error },
      candidateCount: 0,
    }
  }

  const candidateCount = paymentCandidates?.length ?? 0
  if (candidateCount === 1) {
    return {
      paymentId: paymentCandidates?.[0]?.id ?? null,
      paymentCheck: { data: paymentCandidates?.[0] ?? null, error: null },
      candidateCount,
    }
  }

  return {
    paymentId: null,
    paymentCheck: { data: null, error: null },
    candidateCount,
  }
}

export async function assertMedicalRecordStoreConsistency(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  input: MedicalRecordWriteInput,
  paymentId: string | null,
  paymentCheck: { data: { appointment_id?: string | null } | null }
) {
  const [petCheck, staffCheck, appointmentCheck] = await Promise.all([
    supabase.from('pets').select('id').eq('id', input.petId).eq('store_id', storeId).maybeSingle(),
    supabase.from('staffs').select('id').eq('id', input.staffId).eq('store_id', storeId).maybeSingle(),
    supabase
      .from('appointments')
      .select('id, pet_id')
      .eq('id', input.appointmentId)
      .eq('store_id', storeId)
      .maybeSingle(),
  ])

  if (!petCheck.data || !staffCheck.data) {
    throw new MedicalRecordServiceError('ペット・担当の店舗整合性が不正です。')
  }
  if (!appointmentCheck.data) {
    throw new MedicalRecordServiceError('予約の店舗整合性が不正です。')
  }
  if (appointmentCheck.data.pet_id !== input.petId) {
    throw new MedicalRecordServiceError('予約とペットの紐づけが不正です。')
  }
  if (paymentId && !paymentCheck.data) {
    throw new MedicalRecordServiceError('会計の店舗整合性が不正です。')
  }
  if (paymentId && paymentCheck.data && paymentCheck.data.appointment_id !== input.appointmentId) {
    throw new MedicalRecordServiceError('会計と予約の紐づけが不正です。')
  }
}

export async function syncMedicalRecordPhotos(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  recordId: string,
  petId: string,
  appointmentId: string,
  recordDate: string,
  photos: MedicalRecordPhotoDraft[]
) {
  const { error: deleteError } = await supabase
    .from('medical_record_photos')
    .delete()
    .eq('medical_record_id', recordId)
    .eq('store_id', storeId)

  if (deleteError) {
    throw new MedicalRecordServiceError(deleteError.message, 500)
  }

  if (photos.length === 0) return

  const photoRows: Database['public']['Tables']['medical_record_photos']['Insert'][] = photos.map(
    (photo, index) => ({
      store_id: storeId,
      medical_record_id: recordId,
      pet_id: petId,
      appointment_id: appointmentId,
      photo_type: photo.photoType,
      storage_path: photo.storagePath,
      comment: photo.comment || null,
      sort_order: index,
      taken_at: photo.takenAt ?? recordDate,
    })
  )

  const { error: insertError } = await supabase.from('medical_record_photos').insert(photoRows)

  if (insertError) {
    throw new MedicalRecordServiceError(insertError.message, 500)
  }
}

export async function syncMedicalRecordVideos(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  recordId: string,
  petId: string,
  appointmentId: string,
  recordDate: string,
  videos: MedicalRecordVideoDraft[]
) {
  const { error: deleteError } = await supabase
    .from('medical_record_videos' as never)
    .delete()
    .eq('medical_record_id', recordId)
    .eq('store_id', storeId)

  if (deleteError) {
    throw new MedicalRecordServiceError(deleteError.message, 500)
  }

  if (videos.length === 0) return

  const VIDEO_STORAGE_BUCKET = getMedicalRecordVideoBucket()
  const resolvedThumbnails = await Promise.all(
    videos.map(async (video) => {
      if (video.thumbnailPath) {
        return video.thumbnailPath
      }
      const generatedPath = buildMedicalRecordVideoThumbnailPath({
        storeId,
        medicalRecordId: recordId,
        sourcePath: video.storagePath,
      })
      const { error: copyError } = await supabase.storage
        .from(VIDEO_STORAGE_BUCKET)
        .copy(video.storagePath, generatedPath)
      if (copyError) {
        return null
      }
      return generatedPath
    })
  )

  const videoRows = videos.map((video, index) => ({
    store_id: storeId,
    medical_record_id: recordId,
    pet_id: petId,
    appointment_id: appointmentId,
    storage_path: video.storagePath,
    thumbnail_path: resolvedThumbnails[index] ?? null,
    line_short_path: video.lineShortPath ?? null,
    duration_sec: video.durationSec,
    size_bytes: video.sizeBytes ?? 0,
    source_type: video.sourceType,
    comment: video.comment || null,
    sort_order: index,
    taken_at: video.takenAt ?? recordDate,
  }))

  const { error: insertError } = await supabase.from('medical_record_videos' as never).insert(videoRows as never)

  if (insertError) {
    throw new MedicalRecordServiceError(insertError.message, 500)
  }
}

export async function listMedicalRecordStoragePaths(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  recordId: string
) {
  const [{ data: recordRow, error: recordError }, { data: photoRows, error: photoError }] = await Promise.all([
    supabase
      .from('medical_records')
      .select('photos')
      .eq('id', recordId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('medical_record_photos')
      .select('storage_path')
      .eq('medical_record_id', recordId)
      .eq('store_id', storeId),
  ])

  if (recordError) {
    throw new MedicalRecordServiceError(recordError.message, 500)
  }

  if (photoError) {
    throw new MedicalRecordServiceError(photoError.message, 500)
  }

  const recordPhotos = Array.isArray(recordRow?.photos)
    ? recordRow.photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  const photoPaths = (photoRows ?? [])
    .map((row) => row.storage_path)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  return Array.from(new Set([...recordPhotos, ...photoPaths]))
}

export async function removeStorageObjects(storagePaths: string[]) {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)))
  if (uniquePaths.length === 0) return

  try {
    const admin = createAdminSupabaseClient()
    const bucket = getMedicalRecordPhotoBucket()
    const { error } = await admin.storage.from(bucket).remove(uniquePaths)

    if (error) {
      console.error('Failed to remove Supabase Storage objects:', {
        bucket,
        storagePaths: uniquePaths,
        message: error.message,
      })
    }
  } catch (error) {
    console.error('Failed to initialize Supabase Storage cleanup:', {
      storagePaths: uniquePaths,
      error,
    })
  }
}
