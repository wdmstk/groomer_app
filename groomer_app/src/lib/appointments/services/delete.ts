import type { AppointmentSupabaseClient } from '@/lib/appointments/services/shared'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'

async function countAppointmentReferences(
  supabase: AppointmentSupabaseClient,
  table: string,
  storeId: string,
  column: string,
  appointmentId: string
) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, appointmentId)
    .eq('store_id', storeId)

  if (error) {
    throw new AppointmentServiceError(error.message, 500)
  }

  return count ?? 0
}

async function clearNullableAppointmentReferences(
  supabase: AppointmentSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const nullableReferences = [
    {
      table: 'customer_followup_tasks',
      column: 'source_appointment_id',
      payload: { source_appointment_id: null },
    },
    {
      table: 'customer_notification_logs',
      column: 'appointment_id',
      payload: { appointment_id: null },
    },
    {
      table: 'medical_records',
      column: 'appointment_id',
      payload: { appointment_id: null },
    },
    {
      table: 'visits',
      column: 'appointment_id',
      payload: { appointment_id: null },
    },
    {
      table: 'hotel_stays',
      column: 'appointment_id',
      payload: { appointment_id: null },
    },
  ] as const

  for (const reference of nullableReferences) {
    const { error } = await supabase
      .from(reference.table)
      .update(reference.payload)
      .eq(reference.column, appointmentId)
      .eq('store_id', storeId)

    if (error) {
      throw new AppointmentServiceError(error.message, 500)
    }
  }
}

async function clearReoffers(
  supabase: AppointmentSupabaseClient,
  storeId: string,
  appointmentId: string
) {
  const { data: reoffers, error: reofferSelectError } = await supabase
    .from('slot_reoffers')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (reofferSelectError) {
    throw new AppointmentServiceError(reofferSelectError.message, 500)
  }

  const reofferIds = (reoffers ?? []).map((row) => row.id)

  if (reofferIds.length > 0) {
    const { error: notificationLogError } = await supabase
      .from('customer_notification_logs')
      .update({ slot_reoffer_id: null })
      .in('slot_reoffer_id', reofferIds)
      .eq('store_id', storeId)

    if (notificationLogError) {
      throw new AppointmentServiceError(notificationLogError.message, 500)
    }
  }

  const { error: reofferLogError } = await supabase
    .from('slot_reoffer_logs')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (reofferLogError) {
    throw new AppointmentServiceError(reofferLogError.message, 500)
  }

  const { error: reofferDeleteError } = await supabase
    .from('slot_reoffers')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (reofferDeleteError) {
    throw new AppointmentServiceError(reofferDeleteError.message, 500)
  }
}

export async function deleteAppointment(params: {
  supabase: AppointmentSupabaseClient
  storeId: string
  appointmentId: string
}) {
  const { supabase, storeId, appointmentId } = params

  const paymentCount = await countAppointmentReferences(
    supabase,
    'payments',
    storeId,
    'appointment_id',
    appointmentId
  )
  if (paymentCount > 0) {
    throw new AppointmentServiceError(
      '会計データが紐づく予約は削除できません。先に会計を削除または解除してください。',
      409
    )
  }

  const medicalPhotoCount = await countAppointmentReferences(
    supabase,
    'medical_record_photos',
    storeId,
    'appointment_id',
    appointmentId
  )
  if (medicalPhotoCount > 0) {
    throw new AppointmentServiceError(
      '写真カルテの写真が紐づく予約は削除できません。先に写真カルテ側の整理をしてください。',
      409
    )
  }

  const { error: appointmentMenuDeleteError } = await supabase
    .from('appointment_menus')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (appointmentMenuDeleteError) {
    throw new AppointmentServiceError(appointmentMenuDeleteError.message, 500)
  }

  await clearNullableAppointmentReferences(supabase, storeId, appointmentId)
  await clearReoffers(supabase, storeId, appointmentId)

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId)
    .eq('store_id', storeId)

  if (error) {
    if (error.message.includes('violates foreign key constraint')) {
      throw new AppointmentServiceError(
        '関連データが残っているため予約を削除できません。会計・ホテル宿泊・カルテ連携状況を確認してください。',
        409
      )
    }
    throw new AppointmentServiceError(error.message, 500)
  }

  return { success: true as const }
}
