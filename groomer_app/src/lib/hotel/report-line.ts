import { createHash } from 'node:crypto'

export function getJstDateKey(baseDate = new Date()) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(baseDate)
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function buildHotelStayReportDedupeKey(params: {
  stayId: string
  reportBody: string
  now?: Date
}) {
  const hash = createHash('sha1')
    .update(params.reportBody.trim().replace(/\s+/g, ' '))
    .digest('hex')
    .slice(0, 12)
  return `hotel_stay_report:${params.stayId}:${getJstDateKey(params.now)}:${hash}`
}
