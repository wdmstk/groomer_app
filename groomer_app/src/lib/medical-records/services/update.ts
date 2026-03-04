import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  parseMedicalRecordPhotoDrafts,
} from '@/lib/medical-records/photos'
import {
  assertMedicalRecordStoreConsistency,
  listMedicalRecordStoragePaths,
  MedicalRecordServiceError,
  type MedicalRecordSupabaseClient,
  type MedicalRecordWriteInput,
  normalizeStatus,
  removeStorageObjects,
  resolvePaymentLink,
  syncMedicalRecordPhotos,
  validateMedicalRecordWriteInput,
} from '@/lib/medical-records/services/shared'

export type UpdateMedicalRecordInput = MedicalRecordWriteInput

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : null
  }
  return null
}

export function normalizeUpdateMedicalRecordJsonInput(body: Record<string, unknown> | null): UpdateMedicalRecordInput {
  return {
    petId: toOptionalString(body?.pet_id),
    staffId: toOptionalString(body?.staff_id),
    appointmentId: toOptionalString(body?.appointment_id),
    requestedPaymentId: toOptionalString(body?.payment_id),
    status: normalizeStatus(toOptionalString(body?.status)),
    recordDate: toOptionalString(body?.record_date),
    menu: toOptionalString(body?.menu),
    duration: toOptionalNumber(body?.duration),
    shampooUsed: toOptionalString(body?.shampoo_used),
    skinCondition: toOptionalString(body?.skin_condition),
    behaviorNotes: toOptionalString(body?.behavior_notes),
    cautionNotes: toOptionalString(body?.caution_notes),
    photoDrafts: parseMedicalRecordPhotoDrafts(toOptionalString(body?.photo_payload)),
  }
}

function toOptionalFormString(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

function toOptionalFormNumber(value: FormDataEntryValue | null) {
  if (value === null) return null
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

export function normalizeUpdateMedicalRecordFormInput(formData: FormData): UpdateMedicalRecordInput {
  return {
    petId: toOptionalFormString(formData.get('pet_id')),
    staffId: toOptionalFormString(formData.get('staff_id')),
    appointmentId: toOptionalFormString(formData.get('appointment_id')),
    requestedPaymentId: toOptionalFormString(formData.get('payment_id')),
    status: normalizeStatus(toOptionalFormString(formData.get('status'))),
    recordDate: toOptionalFormString(formData.get('record_date')),
    menu: toOptionalFormString(formData.get('menu')),
    duration: toOptionalFormNumber(formData.get('duration')),
    shampooUsed: toOptionalFormString(formData.get('shampoo_used')),
    skinCondition: toOptionalFormString(formData.get('skin_condition')),
    behaviorNotes: toOptionalFormString(formData.get('behavior_notes')),
    cautionNotes: toOptionalFormString(formData.get('caution_notes')),
    photoDrafts: parseMedicalRecordPhotoDrafts(toOptionalFormString(formData.get('photo_payload'))),
  }
}

async function ensureUniqueAppointmentRecord(
  supabase: MedicalRecordSupabaseClient,
  storeId: string,
  appointmentId: string,
  recordId: string
) {
  const { data } = await supabase
    .from('medical_records')
    .select('id')
    .eq('store_id', storeId)
    .eq('appointment_id', appointmentId)
    .neq('id', recordId)
    .maybeSingle()

  return !data
}

export async function updateMedicalRecord(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  recordId: string
  input: UpdateMedicalRecordInput
}) {
  validateMedicalRecordWriteInput(params.input)

  const { supabase, storeId, recordId, input } = params
  const previousStoragePaths = await listMedicalRecordStoragePaths(supabase, storeId, recordId)
  const isUnique = await ensureUniqueAppointmentRecord(supabase, storeId, input.appointmentId!, recordId)
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

  const { data, error } = await supabase
    .from('medical_records')
    .update({
      pet_id: input.petId,
      staff_id: input.staffId,
      appointment_id: input.appointmentId,
      payment_id: resolvedPayment.paymentId,
      status: input.status,
      finalized_at: input.status === 'finalized' ? new Date().toISOString() : null,
      record_date: input.recordDate,
      menu: input.menu,
      duration: input.duration,
      shampoo_used: input.shampooUsed,
      skin_condition: input.skinCondition,
      behavior_notes: input.behaviorNotes,
      photos: input.photoDrafts.map((photo) => photo.storagePath),
      caution_notes: input.cautionNotes,
      store_id: storeId,
    })
    .eq('id', recordId)
    .eq('store_id', storeId)
    .select(
      'id, pet_id, staff_id, appointment_id, payment_id, status, finalized_at, record_date, menu, duration, shampoo_used, skin_condition, behavior_notes, photos, caution_notes'
    )
    .single()

  if (error) {
    throw new MedicalRecordServiceError(error.message, 500)
  }

  await syncMedicalRecordPhotos(
    supabase,
    storeId,
    recordId,
    input.petId!,
    input.appointmentId!,
    input.recordDate!,
    input.photoDrafts
  )

  const nextStoragePaths = input.photoDrafts.map((photo) => photo.storagePath)
  const obsoleteStoragePaths = previousStoragePaths.filter((path) => !nextStoragePaths.includes(path))
  await removeStorageObjects(obsoleteStoragePaths)

  return data
}
