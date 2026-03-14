const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type PublicReserveSlotConfig = {
  days: number
  intervalMinutes: number
  bufferMinutes: number
  businessStartHour: number
  businessEndHour: number
  maxSlots: number
  minLeadMinutes: number
}

export type PartialPublicReserveSlotConfig = Partial<PublicReserveSlotConfig>

type AppointmentRange = {
  start_time: string | null
  end_time: string | null
}

type TimeRange = {
  startMs: number
  endMs: number
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getPublicReserveSlotConfig(): PublicReserveSlotConfig {
  const businessStartHour = clampInt(envInt('PUBLIC_RESERVE_BUSINESS_START_HOUR_JST', 10), 0, 23)
  const businessEndHour = clampInt(envInt('PUBLIC_RESERVE_BUSINESS_END_HOUR_JST', 18), 1, 24)
  return {
    days: clampInt(envInt('PUBLIC_RESERVE_SLOT_DAYS', 7), 1, 7),
    intervalMinutes: clampInt(envInt('PUBLIC_RESERVE_SLOT_INTERVAL_MINUTES', 30), 30, 30),
    bufferMinutes: clampInt(envInt('PUBLIC_RESERVE_SLOT_BUFFER_MINUTES', 15), 0, 60),
    businessStartHour,
    businessEndHour: Math.max(businessEndHour, businessStartHour + 1),
    maxSlots: clampInt(envInt('PUBLIC_RESERVE_SLOT_MAX_RESULTS', 30), 5, 100),
    minLeadMinutes: clampInt(envInt('PUBLIC_RESERVE_MIN_LEAD_MINUTES', 60), 60, 24 * 60),
  }
}

export function mergePublicReserveSlotConfig(
  base: PublicReserveSlotConfig,
  override: PartialPublicReserveSlotConfig | null | undefined
) {
  if (!override) return base
  const businessStartHour = clampInt(
    override.businessStartHour ?? base.businessStartHour,
    0,
    23
  )
  const businessEndHourCandidate = clampInt(
    override.businessEndHour ?? base.businessEndHour,
    1,
    24
  )
  const businessEndHour = Math.max(businessEndHourCandidate, businessStartHour + 1)

  return {
    days: clampInt(override.days ?? base.days, 1, 7),
    intervalMinutes: clampInt(override.intervalMinutes ?? base.intervalMinutes, 30, 30),
    bufferMinutes: clampInt(override.bufferMinutes ?? base.bufferMinutes, 0, 60),
    businessStartHour,
    businessEndHour,
    maxSlots: clampInt(override.maxSlots ?? base.maxSlots, 5, 100),
    minLeadMinutes: clampInt(override.minLeadMinutes ?? base.minLeadMinutes, 60, 24 * 60),
  }
}

function toJstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  }
}

function createUtcFromJst(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - JST_OFFSET_MS)
}

function addDaysJst(base: Date, days: number) {
  const parts = toJstParts(base)
  return createUtcFromJst(parts.year, parts.month, parts.day + days, 0, 0)
}

function toRanges(rows: AppointmentRange[], bufferMinutes: number): TimeRange[] {
  const bufferMs = bufferMinutes * 60 * 1000
  return rows
    .map((row) => {
      const startMs = row.start_time ? new Date(row.start_time).getTime() : NaN
      const endMs = row.end_time ? new Date(row.end_time).getTime() : NaN
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
      return {
        startMs: startMs - bufferMs,
        endMs: endMs + bufferMs,
      }
    })
    .filter((row): row is TimeRange => Boolean(row))
}

function hasConflict(candidateStartMs: number, candidateEndMs: number, ranges: TimeRange[]) {
  return ranges.some((range) => candidateStartMs < range.endMs && candidateEndMs > range.startMs)
}

export function buildSlotCandidates(params: {
  now: Date
  occupiedAppointments: AppointmentRange[]
  serviceDurationMinutes: number
  config: PublicReserveSlotConfig
  blockedDateKeysJst?: string[]
}) {
  const { now, occupiedAppointments, serviceDurationMinutes, config, blockedDateKeysJst = [] } = params
  const safeDurationMinutes = Math.max(1, Math.round(serviceDurationMinutes))
  const intervalMs = config.intervalMinutes * 60 * 1000
  const durationMs = safeDurationMinutes * 60 * 1000
  const leadThresholdMs = now.getTime() + config.minLeadMinutes * 60 * 1000
  const occupiedRanges = toRanges(occupiedAppointments, config.bufferMinutes)
  const blockedDaySet = new Set(blockedDateKeysJst)
  const slots: Array<{ start_time: string; end_time: string }> = []

  for (let dayOffset = 0; dayOffset < config.days; dayOffset += 1) {
    const dayStart = addDaysJst(now, dayOffset)
    const parts = toJstParts(dayStart)
    const month = String(parts.month + 1).padStart(2, '0')
    const day = String(parts.day).padStart(2, '0')
    const dateKeyJst = `${parts.year}-${month}-${day}`
    if (blockedDaySet.has(dateKeyJst)) {
      continue
    }
    const windowStart = createUtcFromJst(
      parts.year,
      parts.month,
      parts.day,
      config.businessStartHour,
      0
    ).getTime()
    const windowEnd = createUtcFromJst(
      parts.year,
      parts.month,
      parts.day,
      config.businessEndHour,
      0
    ).getTime()

    for (let cursorMs = windowStart; cursorMs + durationMs <= windowEnd; cursorMs += intervalMs) {
      if (cursorMs < leadThresholdMs) continue
      const endMs = cursorMs + durationMs
      if (hasConflict(cursorMs, endMs, occupiedRanges)) continue
      slots.push({
        start_time: new Date(cursorMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
      })
      if (slots.length >= config.maxSlots) {
        return slots
      }
    }
  }

  return slots
}
