import type { AppointmentSupabaseClient } from '@/lib/appointments/services/shared'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'

export async function deleteAppointment(params: {
  supabase: AppointmentSupabaseClient
  storeId: string
  appointmentId: string
}) {
  const { supabase, storeId, appointmentId } = params
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId)
    .eq('store_id', storeId)

  if (error) {
    throw new AppointmentServiceError(error.message, 500)
  }

  return { success: true as const }
}
