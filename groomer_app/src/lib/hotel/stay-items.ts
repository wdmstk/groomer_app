import type { Database } from '@/lib/supabase/database.types'
import { asObjectOrNull } from '@/lib/object-utils'

export const ACTIVE_STAY_STATUSES = ['reserved', 'checked_in'] as const

export type HotelMenuItemType = 'overnight' | 'time_pack' | 'option' | 'transport' | 'other'
export type HotelBillingUnit = 'per_stay' | 'per_night' | 'per_hour' | 'fixed'

export type HotelMenuItemRow = {
  id: string
  name: string
  item_type: HotelMenuItemType
  billing_unit: HotelBillingUnit
  duration_minutes: number | null
  default_quantity: number
  price: number
  tax_rate: number
  tax_included: boolean
  counts_toward_capacity: boolean
  is_active: boolean
  display_order: number
  notes: string | null
}

export type SelectedStayItemInput = {
  menu_item_id: string
  quantity?: number | null
  notes?: string | null
}

export type StayItemSnapshot = Database['public']['Tables']['hotel_stay_items']['Insert']

export function parseOptionalInteger(value: unknown, fallback: number | null = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function parsePositiveNumber(value: unknown, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim())
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

export function parsePositiveInteger(value: unknown, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

export function parseSelectedStayItems(value: unknown): SelectedStayItemInput[] {
  if (!Array.isArray(value)) return [] as SelectedStayItemInput[]
  const rows: SelectedStayItemInput[] = []
  value.forEach((item) => {
    const row = asObjectOrNull(item)
    if (!row) return
    const menuItemId = typeof row.menu_item_id === 'string' ? row.menu_item_id.trim() : ''
    if (!menuItemId) return
    rows.push({
      menu_item_id: menuItemId,
      quantity: parsePositiveInteger(row.quantity, 1),
      notes: typeof row.notes === 'string' && row.notes.trim().length > 0 ? row.notes.trim() : null,
    })
  })
  return rows
}

export function buildStayItemSnapshots(params: {
  storeId: string
  stayId: string
  menuItems: HotelMenuItemRow[]
  selections: SelectedStayItemInput[]
  nights: number
}) {
  const menuItemMap = new Map(params.menuItems.map((item) => [item.id, item]))
  const rows: StayItemSnapshot[] = []

  params.selections.forEach((selection, index) => {
    const menuItem = menuItemMap.get(selection.menu_item_id)
    if (!menuItem || !menuItem.is_active) {
      throw new Error(`menu_item_id not found: ${selection.menu_item_id}`)
    }

    const quantity =
      menuItem.billing_unit === 'per_night'
        ? Math.max(1, params.nights)
        : menuItem.billing_unit === 'per_stay' || menuItem.billing_unit === 'fixed'
          ? 1
          : parsePositiveInteger(selection.quantity, Math.max(1, Math.floor(menuItem.default_quantity || 1)))
    const unitPrice = Math.max(0, Math.floor(menuItem.price))
    const lineAmount = Math.round(unitPrice * quantity)

    rows.push({
      store_id: params.storeId,
      stay_id: params.stayId,
      menu_item_id: menuItem.id,
      item_type: menuItem.item_type,
      label_snapshot: menuItem.name,
      billing_unit_snapshot: menuItem.billing_unit,
      quantity,
      unit_price_snapshot: unitPrice,
      line_amount_jpy: lineAmount,
      tax_rate_snapshot: menuItem.tax_rate,
      tax_included_snapshot: menuItem.tax_included,
      counts_toward_capacity: menuItem.counts_toward_capacity,
      sort_order: index,
      notes: selection.notes ?? menuItem.notes ?? null,
    })
  })

  return rows
}

export function deriveTransportFlagsFromSelections(params: {
  menuItems: HotelMenuItemRow[]
  selections: SelectedStayItemInput[]
}) {
  const selectedMenuItems = params.selections
    .map((selection) => params.menuItems.find((item) => item.id === selection.menu_item_id))
    .filter((item): item is HotelMenuItemRow => Boolean(item))

  const labels = selectedMenuItems.map((item) => item.name)
  const hasTransport = selectedMenuItems.some((item) => item.item_type === 'transport')
  const hasRoundTrip = labels.some((label) => /往復/.test(label))
  const hasPickupOnly = labels.some((label) => /迎え|お迎え/.test(label))
  const hasDropoffOnly = labels.some((label) => /送り|お送り/.test(label))

  return {
    pickupRequired: hasRoundTrip || hasPickupOnly || (hasTransport && !hasDropoffOnly),
    dropoffRequired: hasRoundTrip || hasDropoffOnly || (hasTransport && !hasPickupOnly),
  }
}

export function sumStayItemAmount(rows: Array<{ line_amount_jpy: number | null | undefined }>) {
  return rows.reduce((sum, row) => {
    const amount = Number(row.line_amount_jpy ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
}

export function intersectsStayRange(params: {
  candidateStartIso: string
  candidateEndIso: string
  existingStartIso: string
  existingEndIso: string
}) {
  const candidateStart = new Date(params.candidateStartIso).getTime()
  const candidateEnd = new Date(params.candidateEndIso).getTime()
  const existingStart = new Date(params.existingStartIso).getTime()
  const existingEnd = new Date(params.existingEndIso).getTime()

  if (
    !Number.isFinite(candidateStart) ||
    !Number.isFinite(candidateEnd) ||
    !Number.isFinite(existingStart) ||
    !Number.isFinite(existingEnd)
  ) {
    return false
  }

  return existingStart < candidateEnd && existingEnd > candidateStart
}

export function summarizeCapacityTimeline(
  stays: Array<{
    id: string
    status: string
    planned_check_in_at: string
    planned_check_out_at: string
  }>,
  capacity: number
) {
  const points = stays.flatMap((stay) => [
    { at: stay.planned_check_in_at, delta: 1 },
    { at: stay.planned_check_out_at, delta: -1 },
  ])

  points.sort((a, b) => {
    const atDiff = new Date(a.at).getTime() - new Date(b.at).getTime()
    if (atDiff !== 0) return atDiff
    return a.delta - b.delta
  })

  let current = 0
  let peak = 0
  let exceeded = false

  points.forEach((point) => {
    current += point.delta
    peak = Math.max(peak, current)
    if (current > capacity) exceeded = true
  })

  return {
    peak,
    exceeded,
  }
}
