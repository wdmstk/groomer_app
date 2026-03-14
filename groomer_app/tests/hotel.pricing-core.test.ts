import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateHotelPricing } from '../src/lib/hotel/pricing-core.ts'

test('calculateHotelPricing: per_night with transport and holiday surcharge', () => {
  const summary = calculateHotelPricing({
    rule: {
      pricingMode: 'per_night',
      baseAmountJpy: 4500,
      hourlyUnitMinutes: null,
      hourlyUnitAmountJpy: null,
      overtimeUnitMinutes: 30,
      overtimeUnitAmountJpy: 600,
      pickupAmountJpy: 1200,
      dropoffAmountJpy: 1200,
      holidaySurchargeAmountJpy: 1000,
    },
    plannedCheckInAtIso: '2026-06-10T01:00:00.000Z',
    plannedCheckOutAtIso: '2026-06-12T01:00:00.000Z',
    nights: 2,
    pickupRequired: true,
    dropoffRequired: true,
    isHoliday: true,
  })

  assert.equal(summary.totalAmountJpy, 12400)
  assert.equal(summary.lines[0]?.lineAmountJpy, 9000)
  assert.equal(summary.lines[1]?.chargeType, 'transport_pickup')
  assert.equal(summary.lines[2]?.chargeType, 'transport_dropoff')
  assert.equal(summary.lines[3]?.chargeType, 'holiday_surcharge')
})

test('calculateHotelPricing: per_hour rounds up stay and overtime', () => {
  const summary = calculateHotelPricing({
    rule: {
      pricingMode: 'per_hour',
      baseAmountJpy: 500,
      hourlyUnitMinutes: 60,
      hourlyUnitAmountJpy: 1000,
      overtimeUnitMinutes: 30,
      overtimeUnitAmountJpy: 700,
      pickupAmountJpy: 0,
      dropoffAmountJpy: 0,
      holidaySurchargeAmountJpy: 0,
    },
    plannedCheckInAtIso: '2026-06-10T01:00:00.000Z',
    plannedCheckOutAtIso: '2026-06-10T05:00:00.000Z',
    actualCheckInAtIso: '2026-06-10T01:05:00.000Z',
    actualCheckOutAtIso: '2026-06-10T05:50:00.000Z',
  })

  assert.equal(summary.stayMinutes, 285)
  assert.equal(summary.overtimeMinutes, 50)
  assert.equal(summary.lines[0]?.lineAmountJpy, 5500)
  assert.equal(summary.lines[1]?.lineAmountJpy, 1400)
  assert.equal(summary.totalAmountJpy, 6900)
})

test('calculateHotelPricing: flat mode uses planned times when actual times are absent', () => {
  const summary = calculateHotelPricing({
    rule: {
      pricingMode: 'flat',
      baseAmountJpy: 8000,
      hourlyUnitMinutes: null,
      hourlyUnitAmountJpy: null,
      overtimeUnitMinutes: null,
      overtimeUnitAmountJpy: null,
      pickupAmountJpy: 0,
      dropoffAmountJpy: 0,
      holidaySurchargeAmountJpy: 0,
    },
    plannedCheckInAtIso: '2026-06-10T01:00:00.000Z',
    plannedCheckOutAtIso: '2026-06-10T12:30:00.000Z',
  })

  assert.equal(summary.stayMinutes, 690)
  assert.equal(summary.totalAmountJpy, 8000)
  assert.equal(summary.lines.length, 1)
})

test('calculateHotelPricing: throws when planned checkout is not after planned checkin', () => {
  assert.throws(() => {
    calculateHotelPricing({
      rule: {
        pricingMode: 'flat',
        baseAmountJpy: 1000,
        hourlyUnitMinutes: null,
        hourlyUnitAmountJpy: null,
        overtimeUnitMinutes: null,
        overtimeUnitAmountJpy: null,
        pickupAmountJpy: 0,
        dropoffAmountJpy: 0,
        holidaySurchargeAmountJpy: 0,
      },
      plannedCheckInAtIso: '2026-06-10T01:00:00.000Z',
      plannedCheckOutAtIso: '2026-06-10T01:00:00.000Z',
    })
  }, /plannedCheckOutAtIso/)
})
