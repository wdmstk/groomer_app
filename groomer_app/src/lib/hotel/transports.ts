export type HotelTransportType = 'pickup' | 'dropoff'

export type HotelTransportStatus =
  | 'pending'
  | 'scheduled'
  | 'dispatched'
  | 'in_transit'
  | 'arrived'
  | 'completed'
  | 'canceled'

export function parseTransportType(value: unknown): HotelTransportType | null {
  if (value === 'pickup' || value === 'dropoff') return value
  return null
}

export function parseTransportStatus(value: unknown, fallback: HotelTransportStatus = 'pending'): HotelTransportStatus {
  if (
    value === 'pending' ||
    value === 'scheduled' ||
    value === 'dispatched' ||
    value === 'in_transit' ||
    value === 'arrived' ||
    value === 'completed' ||
    value === 'canceled'
  ) {
    return value
  }
  return fallback
}

export function parseOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseIsoDateTime(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const normalized = value.trim()
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid datetime.`)
  }
  return date.toISOString()
}

export function deriveInitialTransportStatus(scheduledAt: string | null): HotelTransportStatus {
  return scheduledAt ? 'scheduled' : 'pending'
}

export function buildTransportStatusPatch(params: {
  nextStatus: HotelTransportStatus
  nowIso?: string
}) {
  const nowIso = params.nowIso ?? new Date().toISOString()
  const patch: Record<string, string | null> = {}
  if (params.nextStatus === 'scheduled') patch.scheduled_at = nowIso
  if (params.nextStatus === 'dispatched') patch.dispatched_at = nowIso
  if (params.nextStatus === 'in_transit') patch.in_transit_at = nowIso
  if (params.nextStatus === 'arrived') patch.arrived_at = nowIso
  if (params.nextStatus === 'completed') patch.completed_at = nowIso
  if (params.nextStatus === 'canceled') patch.canceled_at = nowIso
  return patch
}
