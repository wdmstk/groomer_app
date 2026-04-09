import { deleteAppointment } from '@/lib/appointments/services/delete'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'
import { deleteMedicalRecord } from '@/lib/medical-records/services/delete'
import { MedicalRecordServiceError } from '@/lib/medical-records/services/shared'
import type { createStoreScopedClient } from '@/lib/supabase/store'

export class CustomerDeleteServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'CustomerDeleteServiceError'
    this.status = status
  }
}

function toDeleteErrorMessage(errorMessage: string) {
  if (errorMessage.includes('line_webhook_events')) {
    return 'DBスキーマが不足しています。`supabase/supabase_line_webhook_events.sql` を適用してください。'
  }
  return errorMessage
}

type CustomerDeleteSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
type DeleteDeps = {
  deleteAppointmentById: typeof deleteAppointment
  deleteMedicalRecordById: typeof deleteMedicalRecord
}

const defaultDeleteDeps: DeleteDeps = {
  deleteAppointmentById: deleteAppointment,
  deleteMedicalRecordById: deleteMedicalRecord,
}

async function deleteAppointmentsForPet(
  supabase: CustomerDeleteSupabaseClient,
  storeId: string,
  petId: string,
  deps: DeleteDeps
) {
  const { data: rows, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('store_id', storeId)
    .eq('pet_id', petId)

  if (error) {
    throw new CustomerDeleteServiceError(error.message, 500)
  }

  const appointmentIds = (rows ?? []).map((row) => row.id)
  for (const appointmentId of appointmentIds) {
    const { error: paymentDeleteError } = await supabase
      .from('payments')
      .delete()
      .eq('store_id', storeId)
      .eq('appointment_id', appointmentId)
    if (paymentDeleteError) {
      throw new CustomerDeleteServiceError(paymentDeleteError.message, 500)
    }
    try {
      await deps.deleteAppointmentById({
        supabase,
        storeId,
        appointmentId,
      })
    } catch (error) {
      if (error instanceof AppointmentServiceError) {
        throw new CustomerDeleteServiceError(error.message, error.status)
      }
      throw error
    }
  }
}

async function deleteMedicalRecordsForPet(
  supabase: CustomerDeleteSupabaseClient,
  storeId: string,
  petId: string,
  deps: DeleteDeps
) {
  const { data: rows, error } = await supabase
    .from('medical_records')
    .select('id')
    .eq('store_id', storeId)
    .eq('pet_id', petId)

  if (error) {
    throw new CustomerDeleteServiceError(error.message, 500)
  }

  const recordIds = (rows ?? []).map((row) => row.id)
  for (const recordId of recordIds) {
    try {
      await deps.deleteMedicalRecordById({
        supabase,
        storeId,
        recordId,
      })
    } catch (error) {
      if (error instanceof MedicalRecordServiceError) {
        throw new CustomerDeleteServiceError(error.message, error.status)
      }
      throw error
    }
  }
}

async function clearNullablePetReferences(
  supabase: CustomerDeleteSupabaseClient,
  storeId: string,
  petId: string
) {
  const updates = [
    supabase
      .from('customer_followup_tasks')
      .update({ pet_id: null })
      .eq('store_id', storeId)
      .eq('pet_id', petId),
    supabase
      .from('slot_reoffers')
      .update({ target_pet_id: null })
      .eq('store_id', storeId)
      .eq('target_pet_id', petId),
  ]
  const [followupResult, slotTargetResult] = await Promise.all(updates)
  const firstError = followupResult.error ?? slotTargetResult.error
  if (firstError) {
    throw new CustomerDeleteServiceError(firstError.message, 500)
  }
}

async function deletePetCore(
  supabase: CustomerDeleteSupabaseClient,
  storeId: string,
  petId: string,
  deps: DeleteDeps
) {
  await deleteAppointmentsForPet(supabase, storeId, petId, deps)
  await deleteMedicalRecordsForPet(supabase, storeId, petId, deps)
  await clearNullablePetReferences(supabase, storeId, petId)

  const { error: hotelDeleteError } = await supabase
    .from('hotel_stays')
    .delete()
    .eq('store_id', storeId)
    .eq('pet_id', petId)
  if (hotelDeleteError) {
    throw new CustomerDeleteServiceError(hotelDeleteError.message, 500)
  }

  const { error } = await supabase
    .from('pets')
    .delete()
    .eq('store_id', storeId)
    .eq('id', petId)
  if (error) {
    throw new CustomerDeleteServiceError(error.message, 500)
  }
}

async function clearNullableCustomerReferences(
  supabase: CustomerDeleteSupabaseClient,
  storeId: string,
  customerId: string
) {
  const results = await Promise.all([
    supabase
      .from('journal_entries')
      .update({ customer_id: null })
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('hotel_stays')
      .update({ customer_id: null })
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('customer_notification_logs')
      .update({ customer_id: null })
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('line_webhook_events')
      .update({ matched_customer_id: null })
      .eq('store_id', storeId)
      .eq('matched_customer_id', customerId),
    supabase
      .from('pos_orders')
      .update({ customer_id: null })
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('slot_reoffers')
      .update({ target_customer_id: null })
      .eq('store_id', storeId)
      .eq('target_customer_id', customerId),
  ])
  const firstError = results.find((result) => result.error)?.error
  if (firstError) {
    throw new CustomerDeleteServiceError(toDeleteErrorMessage(firstError.message), 500)
  }
}

export async function deletePetWithDependencies(params: {
  supabase: CustomerDeleteSupabaseClient
  storeId: string
  petId: string
  deps?: DeleteDeps
}) {
  const { supabase, storeId, petId, deps = defaultDeleteDeps } = params
  await deletePetCore(supabase, storeId, petId, deps)
  return { success: true as const }
}

export async function deleteCustomerWithDependencies(params: {
  supabase: CustomerDeleteSupabaseClient
  storeId: string
  customerId: string
  deps?: DeleteDeps
}) {
  const { supabase, storeId, customerId, deps = defaultDeleteDeps } = params
  const { data: pets, error: petsError } = await supabase
    .from('pets')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', customerId)

  if (petsError) {
    throw new CustomerDeleteServiceError(petsError.message, 500)
  }

  for (const pet of pets ?? []) {
    await deletePetCore(supabase, storeId, pet.id, deps)
  }

  const { data: customerAppointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', customerId)
  if (appointmentsError) {
    throw new CustomerDeleteServiceError(appointmentsError.message, 500)
  }
  for (const appointment of customerAppointments ?? []) {
    const { error: paymentDeleteError } = await supabase
      .from('payments')
      .delete()
      .eq('store_id', storeId)
      .eq('appointment_id', appointment.id)
    if (paymentDeleteError) {
      throw new CustomerDeleteServiceError(paymentDeleteError.message, 500)
    }
    try {
      await deps.deleteAppointmentById({
        supabase,
        storeId,
        appointmentId: appointment.id,
      })
    } catch (error) {
      if (error instanceof AppointmentServiceError) {
        throw new CustomerDeleteServiceError(error.message, error.status)
      }
      throw error
    }
  }

  const results = await Promise.all([
    supabase
      .from('payments')
      .delete()
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('visits')
      .delete()
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('invoices')
      .delete()
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
    supabase
      .from('appointment_groups')
      .delete()
      .eq('store_id', storeId)
      .eq('customer_id', customerId),
  ])
  const deleteError = results.find((result) => result.error)?.error
  if (deleteError) {
    throw new CustomerDeleteServiceError(deleteError.message, 500)
  }

  await clearNullableCustomerReferences(supabase, storeId, customerId)

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('store_id', storeId)
    .eq('id', customerId)

  if (error) {
    throw new CustomerDeleteServiceError(error.message, 500)
  }

  return { success: true as const }
}
