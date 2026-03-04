import type { MedicalRecordSupabaseClient } from '@/lib/medical-records/services/shared'
import {
  listMedicalRecordStoragePaths,
  MedicalRecordServiceError,
  removeStorageObjects,
} from '@/lib/medical-records/services/shared'

export async function deleteMedicalRecord(params: {
  supabase: MedicalRecordSupabaseClient
  storeId: string
  recordId: string
}) {
  const { supabase, storeId, recordId } = params
  const storagePaths = await listMedicalRecordStoragePaths(supabase, storeId, recordId)
  const { error } = await supabase
    .from('medical_records')
    .delete()
    .eq('id', recordId)
    .eq('store_id', storeId)

  if (error) {
    throw new MedicalRecordServiceError(error.message, 500)
  }

  await removeStorageObjects(storagePaths)

  return { success: true as const }
}
