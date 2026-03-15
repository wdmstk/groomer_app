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

  const { appointmentId, groupId, storeId } = verified.payload
  const admin = createAdminSupabaseClient()

  const { data: appointment, error: fetchError } = await admin
    .from('appointments')
    .select('id, group_id, status, notes')
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (fetchError || !appointment) {
    throw new PublicReservationServiceError('対象予約が見つかりません。', 404)
  }

  const targetGroupId = groupId || appointment.group_id || null
  const { data: targetAppointments, error: siblingError } = targetGroupId
    ? await admin
        .from('appointments')
        .select('id, status, notes')
        .eq('group_id', targetGroupId)
        .eq('store_id', storeId)
    : {
        data: [{ id: appointment.id, status: appointment.status, notes: appointment.notes }],
        error: null,
      }

  if (siblingError || !targetAppointments) {
    throw new PublicReservationServiceError(siblingError?.message ?? '対象予約の取得に失敗しました。', 500)
  }

  const activeAppointments = targetAppointments.filter((item) => item.status !== 'キャンセル')
  if (activeAppointments.length === 0) {
    return { message: 'この予約はすでにキャンセル済みです。', status: 'キャンセル', count: 0 }
  }

  if (activeAppointments.some((item) => item.status === '来店済' || item.status === '完了')) {
    throw new PublicReservationServiceError('来店済みの予約を含むためキャンセルできません。')
  }

  const { error: updateError } = await admin
    .from('appointments')
    .update({
      status: 'キャンセル',
      notes: null,
    })
    .in(
      'id',
      activeAppointments.map((item) => item.id)
    )
    .eq('store_id', storeId)

  if (updateError) {
    throw new PublicReservationServiceError(updateError.message, 500)
  }

  for (const item of activeAppointments) {
    const nextNotes = item.notes
      ? `${item.notes}\n[顧客キャンセルURLでキャンセル]`
      : '[顧客キャンセルURLでキャンセル]'

    const { error: notesError } = await admin
      .from('appointments')
      .update({
        notes: nextNotes,
      })
      .eq('id', item.id)
      .eq('store_id', storeId)

    if (notesError) {
      throw new PublicReservationServiceError(notesError.message, 500)
    }
  }

  return {
    message:
      activeAppointments.length > 1
        ? `${activeAppointments.length}件の家族予約をキャンセルしました。`
        : '予約をキャンセルしました。',
    status: 'キャンセル',
    count: activeAppointments.length,
  }
}
