export type CoatVolume = 'light' | 'normal' | 'heavy'

const SHORT_CYCLE_BREEDS = ['トイプードル', 'プードル', 'ビションフリーゼ', 'マルチーズ', 'シーズー', 'ヨークシャーテリア']
const LONG_CYCLE_BREEDS = ['柴犬', 'ポメラニアン', 'ダックスフンド', 'チワワ', 'コーギー']

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function normalizeCoatVolume(value: string | null | undefined): CoatVolume {
  const normalized = normalizeText(value)
  if (['多', '多め', 'heavy'].includes(normalized)) return 'heavy'
  if (['少', '少なめ', 'light'].includes(normalized)) return 'light'
  return 'normal'
}

export function getRecommendedVisitIntervalDays(params: {
  breed: string | null | undefined
  coatVolume: string | null | undefined
}) {
  const breed = (params.breed ?? '').trim()
  const coatVolume = normalizeCoatVolume(params.coatVolume)

  let days = 45
  if (SHORT_CYCLE_BREEDS.some((item) => breed.includes(item))) {
    days = 35
  } else if (LONG_CYCLE_BREEDS.some((item) => breed.includes(item))) {
    days = 55
  }

  if (coatVolume === 'heavy') days -= 7
  if (coatVolume === 'light') days += 7
  return Math.max(21, Math.min(90, days))
}

export function getRecommendationReason(params: {
  breed: string | null | undefined
  coatVolume: string | null | undefined
  intervalDays: number
}) {
  const breed = params.breed?.trim() || '犬種未登録'
  const coatVolume = normalizeCoatVolume(params.coatVolume)
  const coatLabel =
    coatVolume === 'heavy' ? '毛量: 多め' : coatVolume === 'light' ? '毛量: 少なめ' : '毛量: 標準'
  return `犬種: ${breed} / ${coatLabel} / 施術後${params.intervalDays}日目安`
}

export function addDays(value: string, days: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
