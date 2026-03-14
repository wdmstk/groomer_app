import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHotelStayReportDedupeKey, getJstDateKey } from '../src/lib/hotel/report-line.ts'
import { renderHotelStayReportLineTemplate } from '../src/lib/notification-templates.ts'

test('renderHotelStayReportLineTemplate renders customer, pet and status label', () => {
  const body = renderHotelStayReportLineTemplate({
    customerName: '田中',
    petName: 'ポチ',
    stayStatus: 'checked_in',
    plannedCheckInAt: '2026-07-10T09:00:00+09:00',
    plannedCheckOutAt: '2026-07-11T10:00:00+09:00',
    reportBody: '元気に過ごしています。',
  })
  assert.equal(body.includes('田中'), true)
  assert.equal(body.includes('ポチ'), true)
  assert.equal(body.includes('チェックイン中'), true)
  assert.equal(body.includes('元気に過ごしています。'), true)
})

test('getJstDateKey converts UTC date into JST date key', () => {
  const key = getJstDateKey(new Date('2026-07-10T16:30:00.000Z'))
  assert.equal(key, '2026-07-11')
})

test('buildHotelStayReportDedupeKey is stable with normalized whitespace', () => {
  const now = new Date('2026-07-11T00:00:00+09:00')
  const keyA = buildHotelStayReportDedupeKey({
    stayId: 'stay-1',
    reportBody: '今日は\n元気です。',
    now,
  })
  const keyB = buildHotelStayReportDedupeKey({
    stayId: 'stay-1',
    reportBody: '今日は  元気です。',
    now,
  })
  assert.equal(keyA, keyB)
  assert.equal(keyA.startsWith('hotel_stay_report:stay-1:2026-07-11:'), true)
})
