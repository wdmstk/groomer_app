export type HotelPricingMode = 'per_night' | 'per_hour' | 'flat'

export type HotelChargeType =
  | 'base'
  | 'extension'
  | 'transport_pickup'
  | 'transport_dropoff'
  | 'holiday_surcharge'

export type HotelPricingRuleCore = {
  pricingMode: HotelPricingMode
  baseAmountJpy: number
  hourlyUnitMinutes: number | null
  hourlyUnitAmountJpy: number | null
  overtimeUnitMinutes: number | null
  overtimeUnitAmountJpy: number | null
  pickupAmountJpy: number
  dropoffAmountJpy: number
  holidaySurchargeAmountJpy: number
}

export type HotelPricingInput = {
  rule: HotelPricingRuleCore
  plannedCheckInAtIso: string
  plannedCheckOutAtIso: string
  actualCheckInAtIso?: string | null
  actualCheckOutAtIso?: string | null
  nights?: number
  pickupRequired?: boolean
  dropoffRequired?: boolean
  isHoliday?: boolean
}

export type HotelChargeLine = {
  chargeType: HotelChargeType
  label: string
  quantity: number
  unitAmountJpy: number
  lineAmountJpy: number
}

export type HotelPricingSummary = {
  stayMinutes: number
  overtimeMinutes: number
  lines: HotelChargeLine[]
  totalAmountJpy: number
}

function parseIsoToMs(value: string) {
  const date = new Date(value)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid datetime: ${value}`)
  }
  return ms
}

function positiveInt(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive.`)
  }
  return Math.floor(value)
}

function nonNegativeInt(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be non-negative.`)
  }
  return Math.floor(value)
}

function ceilUnits(value: number, unit: number) {
  if (value <= 0) return 0
  return Math.ceil(value / unit)
}

function makeBaseLine(input: {
  rule: HotelPricingRuleCore
  mode: HotelPricingMode
  stayMinutes: number
  nights: number
}): HotelChargeLine {
  if (input.mode === 'flat') {
    return {
      chargeType: 'base',
      label: 'ホテル基本料金（固定）',
      quantity: 1,
      unitAmountJpy: input.rule.baseAmountJpy,
      lineAmountJpy: input.rule.baseAmountJpy,
    }
  }

  if (input.mode === 'per_night') {
    const nights = positiveInt(input.nights, 'nights')
    return {
      chargeType: 'base',
      label: 'ホテル基本料金（泊数）',
      quantity: nights,
      unitAmountJpy: input.rule.baseAmountJpy,
      lineAmountJpy: input.rule.baseAmountJpy * nights,
    }
  }

  const unitMinutes = positiveInt(input.rule.hourlyUnitMinutes ?? 0, 'hourlyUnitMinutes')
  const unitAmountJpy = nonNegativeInt(input.rule.hourlyUnitAmountJpy ?? 0, 'hourlyUnitAmountJpy')
  const units = ceilUnits(input.stayMinutes, unitMinutes)
  return {
    chargeType: 'base',
    label: 'ホテル基本料金（時間）',
    quantity: units,
    unitAmountJpy,
    lineAmountJpy: unitAmountJpy * units + input.rule.baseAmountJpy,
  }
}

export function calculateHotelPricing(input: HotelPricingInput): HotelPricingSummary {
  const plannedStartMs = parseIsoToMs(input.plannedCheckInAtIso)
  const plannedEndMs = parseIsoToMs(input.plannedCheckOutAtIso)
  if (plannedEndMs <= plannedStartMs) {
    throw new Error('plannedCheckOutAtIso must be later than plannedCheckInAtIso.')
  }

  const actualStartMs = input.actualCheckInAtIso ? parseIsoToMs(input.actualCheckInAtIso) : plannedStartMs
  const actualEndMs = input.actualCheckOutAtIso ? parseIsoToMs(input.actualCheckOutAtIso) : plannedEndMs
  if (actualEndMs <= actualStartMs) {
    throw new Error('actualCheckOutAtIso must be later than actualCheckInAtIso.')
  }

  const stayMinutes = Math.max(1, Math.ceil((actualEndMs - actualStartMs) / 60000))
  const overtimeMinutes = Math.max(0, Math.ceil((actualEndMs - plannedEndMs) / 60000))

  const rule: HotelPricingRuleCore = {
    pricingMode: input.rule.pricingMode,
    baseAmountJpy: nonNegativeInt(input.rule.baseAmountJpy, 'baseAmountJpy'),
    hourlyUnitMinutes: input.rule.hourlyUnitMinutes,
    hourlyUnitAmountJpy: input.rule.hourlyUnitAmountJpy,
    overtimeUnitMinutes: input.rule.overtimeUnitMinutes,
    overtimeUnitAmountJpy: input.rule.overtimeUnitAmountJpy,
    pickupAmountJpy: nonNegativeInt(input.rule.pickupAmountJpy, 'pickupAmountJpy'),
    dropoffAmountJpy: nonNegativeInt(input.rule.dropoffAmountJpy, 'dropoffAmountJpy'),
    holidaySurchargeAmountJpy: nonNegativeInt(
      input.rule.holidaySurchargeAmountJpy,
      'holidaySurchargeAmountJpy'
    ),
  }

  const lines: HotelChargeLine[] = []
  lines.push(
    makeBaseLine({
      rule,
      mode: rule.pricingMode,
      stayMinutes,
      nights: input.nights ?? 1,
    })
  )

  if (overtimeMinutes > 0 && rule.overtimeUnitMinutes && rule.overtimeUnitAmountJpy) {
    const overtimeUnits = ceilUnits(
      overtimeMinutes,
      positiveInt(rule.overtimeUnitMinutes, 'overtimeUnitMinutes')
    )
    const overtimeUnitAmount = nonNegativeInt(rule.overtimeUnitAmountJpy, 'overtimeUnitAmountJpy')
    lines.push({
      chargeType: 'extension',
      label: '延長料金',
      quantity: overtimeUnits,
      unitAmountJpy: overtimeUnitAmount,
      lineAmountJpy: overtimeUnits * overtimeUnitAmount,
    })
  }

  if (input.pickupRequired && rule.pickupAmountJpy > 0) {
    lines.push({
      chargeType: 'transport_pickup',
      label: '送迎（お迎え）',
      quantity: 1,
      unitAmountJpy: rule.pickupAmountJpy,
      lineAmountJpy: rule.pickupAmountJpy,
    })
  }

  if (input.dropoffRequired && rule.dropoffAmountJpy > 0) {
    lines.push({
      chargeType: 'transport_dropoff',
      label: '送迎（お送り）',
      quantity: 1,
      unitAmountJpy: rule.dropoffAmountJpy,
      lineAmountJpy: rule.dropoffAmountJpy,
    })
  }

  if (input.isHoliday && rule.holidaySurchargeAmountJpy > 0) {
    lines.push({
      chargeType: 'holiday_surcharge',
      label: '休日加算',
      quantity: 1,
      unitAmountJpy: rule.holidaySurchargeAmountJpy,
      lineAmountJpy: rule.holidaySurchargeAmountJpy,
    })
  }

  const totalAmountJpy = lines.reduce((sum, line) => sum + line.lineAmountJpy, 0)

  return {
    stayMinutes,
    overtimeMinutes,
    lines,
    totalAmountJpy,
  }
}
