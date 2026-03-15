import type { AppointmentSupabaseClient } from '@/lib/appointments/services/shared'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'

type GroupSource = 'manual' | 'public' | 'member_portal'

export async function ensureAppointmentGroupId(params: {
  supabase: AppointmentSupabaseClient
  storeId: string
  customerId: string
  existingGroupId?: string | null
  source: GroupSource
}) {
  const { supabase, storeId, customerId, existingGroupId, source } = params

  if (existingGroupId) {
    const { data, error } = await supabase
      .from('appointment_groups')
      .select('id, customer_id')
      .eq('id', existingGroupId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (error) {
      throw new AppointmentServiceError(error.message, 500)
    }

    if (!data) {
      throw new AppointmentServiceError('指定された予約グループが見つかりません。', 404)
    }

    if (data.customer_id !== customerId) {
      throw new AppointmentServiceError('予約グループと顧客が一致しません。')
    }

    return data.id
  }

  const { data, error } = await supabase
    .from('appointment_groups')
    .insert({
      store_id: storeId,
      customer_id: customerId,
      source,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new AppointmentServiceError(error?.message ?? '予約グループの作成に失敗しました。', 500)
  }

  return data.id
}
