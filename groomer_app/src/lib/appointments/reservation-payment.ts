export const RESERVATION_PAYMENT_METHODS = ['none', 'prepayment', 'card_hold'] as const
export const RESERVATION_PAYMENT_STATUSES = [
  'unpaid',
  'authorized',
  'paid',
  'captured',
  'charge_pending',
  'failed',
  'waived',
] as const
export const NO_SHOW_CHARGE_MODES = ['manual', 'auto'] as const

export type ReservationPaymentMethod = (typeof RESERVATION_PAYMENT_METHODS)[number]
export type ReservationPaymentStatus = (typeof RESERVATION_PAYMENT_STATUSES)[number]
export type NoShowChargeMode = (typeof NO_SHOW_CHARGE_MODES)[number]

export type ReservationPaymentSettings = {
  prepayment_enabled: boolean
  card_hold_enabled: boolean
  cancellation_day_before_percent: number
  cancellation_same_day_percent: number
  cancellation_no_show_percent: number
  no_show_charge_mode: NoShowChargeMode
}

export const DEFAULT_RESERVATION_PAYMENT_SETTINGS: ReservationPaymentSettings = {
  prepayment_enabled: false,
  card_hold_enabled: false,
  cancellation_day_before_percent: 0,
  cancellation_same_day_percent: 50,
  cancellation_no_show_percent: 100,
  no_show_charge_mode: 'manual',
}

export function normalizeReservationPaymentMethod(value: string | null | undefined): ReservationPaymentMethod {
  if (value === 'prepayment' || value === 'card_hold') return value
  return 'none'
}

export function normalizeReservationPaymentStatus(value: string | null | undefined): ReservationPaymentStatus {
  if (
    value === 'authorized' ||
    value === 'paid' ||
    value === 'captured' ||
    value === 'charge_pending' ||
    value === 'failed' ||
    value === 'waived'
  ) {
    return value
  }
  return 'unpaid'
}

export function getInitialReservationPaymentState(method: ReservationPaymentMethod) {
  if (method === 'prepayment') {
    return {
      reservationPaymentStatus: 'unpaid' as ReservationPaymentStatus,
      reservationPaymentPaidAt: null as string | null,
      reservationPaymentAuthorizedAt: null as string | null,
    }
  }
  if (method === 'card_hold') {
    return {
      reservationPaymentStatus: 'authorized' as ReservationPaymentStatus,
      reservationPaymentPaidAt: null as string | null,
      reservationPaymentAuthorizedAt: new Date().toISOString(),
    }
  }
  return {
    reservationPaymentStatus: 'unpaid' as ReservationPaymentStatus,
    reservationPaymentPaidAt: null as string | null,
    reservationPaymentAuthorizedAt: null as string | null,
  }
}

export function getReservationPaymentBadge(params: {
  method: string | null | undefined
  status: string | null | undefined
}) {
  const method = normalizeReservationPaymentMethod(params.method)
  const status = normalizeReservationPaymentStatus(params.status)

  if (method === 'prepayment' && (status === 'paid' || status === 'captured')) {
    return { label: '決済済', className: 'bg-emerald-100 text-emerald-800' }
  }
  if (method === 'card_hold' && status === 'authorized') {
    return { label: '仮押さえ', className: 'bg-amber-100 text-amber-900' }
  }
  if (method === 'card_hold' && status === 'captured') {
    return { label: '請求済', className: 'bg-emerald-100 text-emerald-800' }
  }
  if (status === 'charge_pending') {
    return { label: '請求待ち', className: 'bg-sky-100 text-sky-800' }
  }
  if (status === 'failed') {
    return { label: '請求失敗', className: 'bg-red-100 text-red-700' }
  }
  return null
}

export function resolveNoShowChargePercent(status: string | null | undefined, settings: ReservationPaymentSettings) {
  if (status === '無断キャンセル') return settings.cancellation_no_show_percent
  if (status === 'キャンセル') return settings.cancellation_same_day_percent
  return 0
}
