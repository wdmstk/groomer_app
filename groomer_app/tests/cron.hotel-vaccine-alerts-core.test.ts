import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHotelVaccineAlertMessage,
  buildHotelVaccineDedupeKey,
  classifyVaccineAlertLevel,
  diffDaysDateKey,
} from '../src/lib/cron/services/hotel-vaccine-alerts-core.ts'

test('classifyVaccineAlertLevel maps thresholds', () => {
  assert.equal(classifyVaccineAlertLevel(30), 'days_30')
  assert.equal(classifyVaccineAlertLevel(7), 'days_7')
  assert.equal(classifyVaccineAlertLevel(1), 'days_1')
  assert.equal(classifyVaccineAlertLevel(0), 'same_day')
  assert.equal(classifyVaccineAlertLevel(-1), 'expired')
  assert.equal(classifyVaccineAlertLevel(5), null)
})

test('diffDaysDateKey calculates JST day difference', () => {
  assert.equal(diffDaysDateKey('2026-07-31', '2026-07-01'), 30)
  assert.equal(diffDaysDateKey('2026-07-01', '2026-07-01'), 0)
  assert.equal(diffDaysDateKey('2026-06-30', '2026-07-01'), -1)
})

test('buildHotelVaccineDedupeKey includes stay and level', () => {
  const key = buildHotelVaccineDedupeKey({
    stayId: 'stay-1',
    vaccineDateKey: '2026-07-31',
    alertLevel: 'days_30',
    todayJst: '2026-07-01',
  })
  assert.equal(key, 'hotel_vaccine:stay-1:2026-07-31:days_30:2026-07-01')
})

test('buildHotelVaccineAlertMessage includes name, pet and remaining days', () => {
  const msg = buildHotelVaccineAlertMessage({
    customerName: '田中',
    petName: 'ポチ',
    vaccineDateKey: '2026-07-31',
    daysRemaining: 30,
  })
  assert.equal(msg.includes('田中'), true)
  assert.equal(msg.includes('ポチ'), true)
  assert.equal(msg.includes('あと 30 日'), true)
})
