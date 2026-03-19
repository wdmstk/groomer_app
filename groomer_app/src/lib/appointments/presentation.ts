export const appointmentStatusFlowActions = {
  予約済: { nextStatus: '受付', label: '受付開始' },
  受付: { nextStatus: '施術中', label: '施術開始' },
  施術中: { nextStatus: '会計待ち', label: '会計待ちへ' },
  会計待ち: { nextStatus: '完了', label: '完了' },
} as const

export type AppointmentTransitionTimestamps = {
  checked_in_at?: string | null
  in_service_at?: string | null
  payment_waiting_at?: string | null
  completed_at?: string | null
}

export function isAppointmentCompletedStatus(status: string | null | undefined) {
  return status === '来店済' || status === '完了'
}

export function getAppointmentNextStatusAction(status: string | null | undefined) {
  if (!status || status === '予約申請') return null
  return appointmentStatusFlowActions[status as keyof typeof appointmentStatusFlowActions] ?? null
}

export function getAppointmentRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

export function formatAppointmentDateTimeJst(value: string | null | undefined) {
  if (!value) return '未登録'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未登録'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function getAppointmentStatusTransitionTime(
  status: string | null | undefined,
  appointment: AppointmentTransitionTimestamps
) {
  if (status === '受付') return { label: '受付', value: appointment.checked_in_at ?? null }
  if (status === '施術中') return { label: '施術開始', value: appointment.in_service_at ?? null }
  if (status === '会計待ち') return { label: '会計待ち', value: appointment.payment_waiting_at ?? null }
  if (isAppointmentCompletedStatus(status)) return { label: '完了', value: appointment.completed_at ?? null }
  return null
}
