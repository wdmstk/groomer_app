import {
  parseMedicalRecordPhotoDrafts,
} from '@/lib/medical-records/photos'
import { parseMedicalRecordVideoDrafts } from '@/lib/medical-records/videos'
import {
  assertMedicalRecordStoreConsistency,
  MedicalRecordServiceError,
  type MedicalRecordSupabaseClient,
  type MedicalRecordWriteInput,
  normalizeStatus,
  resolvePaymentLink,
  syncMedicalRecordPhotos,
  syncMedicalRecordVideos,
  validateMedicalRecordWriteInput,
} from '@/lib/medical-records/services/shared'
import type { Database } from '@/lib/supabase/database.types'

export type CreateMedicalRecordInput = MedicalRecordWriteInput

function toOptionalString(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null) return null
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

export function normalizeCreateMedicalRecordInput(formData: FormData): CreateMedicalRecordInput {
  return {
    petId: toOptionalString(formData.get('pet_id')),
    staffId: toOptionalString(formData.get('staff_id')),
    appointmentId: toOptionalString(formData.get('appointment_id')),
    requestedPaymentId: toOptionalString(formData.get('payment_id')),
    status: normalizeStatus(toOptionalString(formData.get('status'))),
    recordDate: toOptionalString(formData.get('record_date')),
    menu: toOptionalString(formData.get('menu')),
    duration: toOptionalNumber(formData.get('duration')),
    shampooUsed: toOptionalString(formData.get('shampoo_used')),
    skinCondition: toOptionalString(formData.get('skin_condition')),
    behaviorNotes: toOptionalString(formData.get('behavior_notes')),
    cautionNotes: toOptionalString(formData.get('caution_notes')),
    photoDrafts: parseMedicalRecordPhotoDrafts(toOptionalString(formData.get('photo_payload'))),
    videoDrafts: parseMedicalRecordVideoDrafts(toOptionalString(formData.get('video_payload'))),
  }
}

async function ensureUniqueAppointmentRecord(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const { data } = await supabase
    .from('medical_records')
    .select('id')
    .eq('store_id', storeId)
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  return !data
}

export async function createMedicalRecord(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  input: CreateMedicalRecordInput
}) {
  validateMedicalRecordWriteInput(params.input)

  const { supabase, storeId, input } = params
  const isUnique = await ensureUniqueAppointmentRecord(supabase, storeId, input.appointmentId!)
  if (!isUnique) {
    throw new MedicalRecordServiceError('この来店のカルテはすでに登録されています。')
  }

  const resolvedPayment = await resolvePaymentLink(
    supabase,
    storeId,
    input.appointmentId!,
    input.requestedPaymentId
  )
  if (resolvedPayment.paymentCheck.error) {
    throw new MedicalRecordServiceError(resolvedPayment.paymentCheck.error.message, 500)
  }

  if (input.status === 'finalized' && !resolvedPayment.paymentId) {
    if (resolvedPayment.candidateCount > 1) {
      throw new MedicalRecordServiceError('会計候補が複数あるため、確定には会計を選択してください。')
    }
    throw new MedicalRecordServiceError('カルテ確定には会計の紐づけが必須です。')
  }

  await assertMedicalRecordStoreConsistency(
    supabase,
    storeId,
    input,
    resolvedPayment.paymentId,
    resolvedPayment.paymentCheck
  )

  const payload: Database['public']['Tables']['medical_records']['Insert'] = {
    store_id: storeId,
    pet_id: input.petId!,
    staff_id: input.staffId!,
    appointment_id: input.appointmentId!,
    payment_id: resolvedPayment.paymentId,
    status: input.status,
    finalized_at: input.status === 'finalized' ? new Date().toISOString() : null,
    record_date: input.recordDate!,
    menu: input.menu!,
    duration: input.duration,
    shampoo_used: input.shampooUsed,
    skin_condition: input.skinCondition,
    behavior_notes: input.behaviorNotes,
    photos: input.photoDrafts.map((photo) => photo.storagePath),
    caution_notes: input.cautionNotes,
  }

  const { data: createdRecord, error } = await supabase
    .from('medical_records')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new MedicalRecordServiceError(error.message, 500)
  }

  await syncMedicalRecordPhotos(
    supabase,
    storeId,
    createdRecord.id,
    input.petId!,
    input.appointmentId!,
    input.recordDate!,
    input.photoDrafts
  )

  await syncMedicalRecordVideos(
    supabase,
    storeId,
    createdRecord.id,
    input.petId!,
    input.appointmentId!,
    input.recordDate!,
    input.videoDrafts
  )

  return { id: createdRecord.id }
}
