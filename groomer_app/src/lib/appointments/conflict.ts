import type { SupabaseClient } from '@supabase/supabase-js'

type ConflictCheckParams = {
  supabase: SupabaseClient
  storeId: string
  staffId: string
  startTimeIso: string
  endTimeIso: string
  excludeAppointmentId?: string
}

type ConflictResult =
  | {
      ok: true
    }
  | {
      ok: false
      message: string
      conflict?: {
        appointmentId: string
        startTime: string | null
        endTime: string | null
      }
    }

export async function validateAppointmentConflict({
  supabase,
  storeId,
  staffId,
  startTimeIso,
  endTimeIso,
  excludeAppointmentId,
}: ConflictCheckParams): Promise<ConflictResult> {
  const startMs = new Date(startTimeIso).getTime()
  const endMs = new Date(endTimeIso).getTime()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, message: '予約日時の形式が不正です。' }
  }

  if (startMs >= endMs) {
    return { ok: false, message: '終了日時は開始日時より後に設定してください。' }
  }

  let query = supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('store_id', storeId)
    .eq('staff_id', staffId)
    .lt('start_time', endTimeIso)
    .gt('end_time', startTimeIso)
    .order('start_time', { ascending: true })
    .limit(1)

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId)
  }

  const { data, error } = await query
  if (error) {
    return { ok: false, message: error.message }
  }

  const conflict = (data ?? [])[0]
  if (!conflict) {
    return { ok: true }
  }

  return {
    ok: false,
    message: '同じスタッフに時間が重複する予約があります。',
    conflict: {
      appointmentId: conflict.id,
      startTime: conflict.start_time ?? null,
      endTime: conflict.end_time ?? null,
    },
  }
}
