export type PaymentAppointmentOption = {
  id: string
  customerId: string | null
  startTime: string | null
  customers?: { full_name: string } | { full_name: string }[] | null
  pets?: { name: string } | { name: string }[] | null
}

export function getPaymentRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

export function formatPaymentDateTimeJst(value: string | null | undefined) {
  if (!value) return '日時未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '日時未設定'
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

export function buildPaymentAppointmentLabel(option: PaymentAppointmentOption) {
  const date = formatPaymentDateTimeJst(option.startTime)
  const customerName = getPaymentRelatedValue(option.customers, 'full_name')
  const petName = getPaymentRelatedValue(option.pets, 'name')
  return `${date} / ${customerName} / ${petName}`
}

export function formatPaymentPaidState(paidAt: string | null | undefined) {
  return paidAt ? '会計済' : '未会計'
}

export function formatPaymentPaidAt(paidAt: string | null | undefined) {
  return paidAt ? formatPaymentDateTimeJst(paidAt) : '未払い'
}
