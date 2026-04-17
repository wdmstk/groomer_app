export function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export function parseDateKey(value: string | null | undefined) {
  const v = (value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export function parseDateTimeJst(dateKey: string, timeValue: string) {
  const t = timeValue.trim()
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  return `${dateKey}T${t}:00+09:00`
}

export function parseInteger(value: string | null | undefined, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function parseBoolean(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== 'string') return false
  return value === '1' || value === 'true' || value === 'on'
}

export function parseDateKeyList(value: string | null | undefined) {
  if (!value) return []
  const unique = new Set<string>()
  for (const raw of value.split(/\r?\n/)) {
    const dateKey = raw.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    unique.add(dateKey)
  }
  return [...unique].sort()
}

export function parseWeekdayList(value: string | null | undefined) {
  if (!value) return []
  const unique = new Set<number>()
  for (const token of value.split(',')) {
    const n = Number(token.trim())
    if (!Number.isInteger(n) || n < 0 || n > 6) continue
    unique.add(n)
  }
  return [...unique].sort((a, b) => a - b)
}

export type WorkRuleSlotInput = {
  weekday: number
  start_time: string
  end_time: string
}

export function parseWorkRuleSlots(text: string | null | undefined): WorkRuleSlotInput[] {
  if (!text) return []
  const slots: WorkRuleSlotInput[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = /^([0-6]):(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(line)
    if (!m) continue
    const weekday = Number(m[1])
    const startTime = m[2]
    const endTime = m[3]
    if (startTime >= endTime) continue
    slots.push({ weekday, start_time: startTime, end_time: endTime })
  }
  return slots
}

export function toDateKeyJst(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function isOverlappingRange(targetStartIso: string, targetEndIso: string, startIso: string, endIso: string) {
  const targetStart = new Date(targetStartIso).getTime()
  const targetEnd = new Date(targetEndIso).getTime()
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(targetStart) || !Number.isFinite(targetEnd) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return false
  }
  return targetStart < end && start < targetEnd
}
