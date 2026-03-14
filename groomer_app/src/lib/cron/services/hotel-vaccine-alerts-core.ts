export type VaccineAlertLevel = 'days_30' | 'days_7' | 'days_1' | 'same_day' | 'expired'

export function getJstTodayDateKey(baseDate = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate)
}

export function diffDaysDateKey(targetDateKey: string, baseDateKey: string) {
  const target = new Date(`${targetDateKey}T00:00:00+09:00`)
  const base = new Date(`${baseDateKey}T00:00:00+09:00`)
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null
  return Math.floor((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000))
}

export function classifyVaccineAlertLevel(daysRemaining: number): VaccineAlertLevel | null {
  if (daysRemaining === 30) return 'days_30'
  if (daysRemaining === 7) return 'days_7'
  if (daysRemaining === 1) return 'days_1'
  if (daysRemaining === 0) return 'same_day'
  if (daysRemaining < 0) return 'expired'
  return null
}

export function buildHotelVaccineDedupeKey(params: {
  stayId: string
  vaccineDateKey: string
  alertLevel: VaccineAlertLevel
  todayJst: string
}) {
  return ['hotel_vaccine', params.stayId, params.vaccineDateKey, params.alertLevel, params.todayJst].join(':')
}

export function buildHotelVaccineAlertMessage(params: {
  customerName: string
  petName: string
  vaccineDateKey: string
  daysRemaining: number
}) {
  const suffix =
    params.daysRemaining < 0
      ? '有効期限を過ぎています。来店前に確認をお願いします。'
      : params.daysRemaining === 0
        ? '本日が有効期限です。来店前に確認をお願いします。'
        : `有効期限まであと ${params.daysRemaining} 日です。`
  return `【ワクチン期限アラート】\n${params.customerName} 様の ${params.petName} のワクチン期限は ${params.vaccineDateKey} です。\n${suffix}`
}
