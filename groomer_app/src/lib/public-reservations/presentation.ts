export function formatPublicSlotLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function buildPublicReservePath(storeId: string) {
  const normalizedStoreId = storeId.trim()
  if (!normalizedStoreId) return '/reserve'
  return `/reserve/${encodeURIComponent(normalizedStoreId)}`
}

export function formatPublicSlotTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function toPublicJstDatetimeLocalValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hour = String(shifted.getUTCHours()).padStart(2, '0')
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function getPublicSlotMessage(params: {
  selectedMenuIds: string[]
  instantMenuIds: string[]
}) {
  if (params.selectedMenuIds.length === 0) return ''
  const instantSet = new Set(params.instantMenuIds)
  const isInstantSelection = params.selectedMenuIds.every((id) => instantSet.has(id))
  return isInstantSelection
    ? ''
    : '選択メニューは即時確定枠の対象外です。希望日時を入力して申請してください。'
}

export function buildPublicSubmittedReservationSummary(params: {
  appointmentId?: string
  groupId?: string | null
  currentGroupId: string
  petName: string
  preferredStart: string
  status?: string
  fallbackId?: string
}) {
  return {
    appointmentId: params.appointmentId ?? params.fallbackId ?? `${Date.now()}`,
    groupId: (params.groupId ?? params.currentGroupId) || null,
    petName: params.petName,
    preferredStart: params.preferredStart,
    status: params.status ?? '予約申請',
  }
}

export function getCancelReservationTokenError(token: string) {
  return token ? '' : '無効なURLです。'
}
