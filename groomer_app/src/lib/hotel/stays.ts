import { calculateHotelPricing } from './pricing-core'
import type { Database } from '@/lib/supabase/database.types'

export type HotelStayStatus = 'reserved' | 'checked_in' | 'checked_out' | 'canceled' | 'no_show'

export type HotelPricingRuleRow = {
  id: string
  pricing_mode: 'per_night' | 'per_hour' | 'flat'
  base_amount_jpy: number
  hourly_unit_minutes: number | null
  hourly_unit_amount_jpy: number | null
  overtime_unit_minutes: number | null
  overtime_unit_amount_jpy: number | null
  pickup_amount_jpy: number
  dropoff_amount_jpy: number
  holiday_surcharge_amount_jpy: number
}

export type StayPricingInput = {
  plannedCheckInAtIso: string
  plannedCheckOutAtIso: string
  actualCheckInAtIso?: string | null
  actualCheckOutAtIso?: string | null
  nights: number
  pickupRequired: boolean
  dropoffRequired: boolean
  isHoliday: boolean
}

export const SYSTEM_CHARGE_TYPES = [
  'base',
  'extension',
  'transport_pickup',
  'transport_dropoff',
  'holiday_surcharge',
] as const

export function parseStatus(value: unknown, fallback: HotelStayStatus = 'reserved'): HotelStayStatus {
  if (
    value === 'reserved' ||
    value === 'checked_in' ||
    value === 'checked_out' ||
    value === 'canceled' ||
    value === 'no_show'
  ) {
    return value
  }
  return fallback
}

export function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false
  }
  return fallback
}

export function parseOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseIsoDateTime(value: unknown, fieldName: string, required = false) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    if (required) {
      throw new Error(`${fieldName} is required.`)
    }
    return null
  }
  const normalized = value.trim()
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid datetime.`)
  }
  return date.toISOString()
}

export function parseOptionalDate(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD.`)
  }
  return normalized
}

export function parseNights(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(365, Math.floor(value)))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(365, parsed))
    }
  }
  return fallback
}

export function deriveNightsByPlannedRange(plannedStartIso: string, plannedEndIso: string) {
  const start = new Date(plannedStartIso)
  const end = new Date(plannedEndIso)
  const diffMs = end.getTime() - start.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 1
  }
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

export function generateStayCode(baseDate = new Date()) {
  const yyyy = baseDate.getFullYear().toString()
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0')
  const dd = String(baseDate.getDate()).padStart(2, '0')
  const hh = String(baseDate.getHours()).padStart(2, '0')
  const mi = String(baseDate.getMinutes()).padStart(2, '0')
  const ss = String(baseDate.getSeconds()).padStart(2, '0')
  return `HS-${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export function buildSystemChargeRows(params: {
  storeId: string
  stayId: string
  userId: string
  pricingRule: HotelPricingRuleRow | null
  input: StayPricingInput
}) {
  if (!params.pricingRule) {
    return { rows: [] as Database['public']['Tables']['hotel_charges']['Insert'][], systemTotal: 0 }
  }

  const summary = calculateHotelPricing({
    rule: {
      pricingMode: params.pricingRule.pricing_mode,
      baseAmountJpy: params.pricingRule.base_amount_jpy,
      hourlyUnitMinutes: params.pricingRule.hourly_unit_minutes,
      hourlyUnitAmountJpy: params.pricingRule.hourly_unit_amount_jpy,
      overtimeUnitMinutes: params.pricingRule.overtime_unit_minutes,
      overtimeUnitAmountJpy: params.pricingRule.overtime_unit_amount_jpy,
      pickupAmountJpy: params.pricingRule.pickup_amount_jpy,
      dropoffAmountJpy: params.pricingRule.dropoff_amount_jpy,
      holidaySurchargeAmountJpy: params.pricingRule.holiday_surcharge_amount_jpy,
    },
    plannedCheckInAtIso: params.input.plannedCheckInAtIso,
    plannedCheckOutAtIso: params.input.plannedCheckOutAtIso,
    actualCheckInAtIso: params.input.actualCheckInAtIso ?? null,
    actualCheckOutAtIso: params.input.actualCheckOutAtIso ?? null,
    nights: params.input.nights,
    pickupRequired: params.input.pickupRequired,
    dropoffRequired: params.input.dropoffRequired,
    isHoliday: params.input.isHoliday,
  })

  return {
    rows: summary.lines.map((line) => ({
      store_id: params.storeId,
      stay_id: params.stayId,
      charge_type: line.chargeType,
      label: line.label,
      quantity: line.quantity,
      unit_amount_jpy: line.unitAmountJpy,
      line_amount_jpy: line.lineAmountJpy,
      tax_rate: 0.1,
      tax_included: true,
      created_by_user_id: params.userId,
      updated_at: new Date().toISOString(),
    })),
    systemTotal: summary.totalAmountJpy,
  }
}
