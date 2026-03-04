import { verifyReservationCancelToken } from '@/lib/reservation-cancel-token'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { PublicReservationServiceError } from '@/lib/public-reservations/services/shared'

export async function cancelPublicReservation(params: { token: string }) {
  if (!params.token) {
    throw new PublicReservationServiceError('キャンセルトークンが必要です。')
  }

  const verified = verifyReservationCancelToken(params.token)
  if (!verified.valid) {
    const message =
      verified.reason === 'expired'
        ? 'このキャンセルURLは有効期限切れです。'
        : '無効なキャンセルURLです。'
    throw new PublicReservationServiceError(message)
  }

  const { appointmentId, storeId } = verified.payload
  const admin = createAdminSupabaseClient()

  const { data: appointment, error: fetchError } = await admin
    .from('appointments')
    .select('id, status, notes')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (fetchError || !appointment) {
    throw new PublicReservationServiceError('対象予約が見つかりません。', 404)
  }

  if (appointment.status === 'キャンセル') {
    return { message: 'この予約はすでにキャンセル済みです。', status: 'キャンセル' }
  }

  if (appointment.status === '来店済' || appointment.status === '完了') {
    throw new PublicReservationServiceError('来店済みのためキャンセルできません。')
  }

  const nextNotes = appointment.notes
    ? `${appointment.notes}\n[顧客キャンセルURLでキャンセル]`
    : '[顧客キャンセルURLでキャンセル]'

  const { error: updateError } = await admin
    .from('appointments')
    .update({
      status: 'キャンセル',
      notes: nextNotes,
    })
    .eq('id', appointmentId)
    .eq('store_id', storeId)

  if (updateError) {
    throw new PublicReservationServiceError(updateError.message, 500)
  }

  return {
    message: '予約をキャンセルしました。',
    status: 'キャンセル',
  }
}
