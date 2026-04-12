import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPublicReservePath,
  buildPublicSubmittedReservationSummary,
  formatPublicSlotLabel,
  formatPublicSlotTime,
  getCancelReservationTokenError,
  getPublicSlotMessage,
  toPublicJstDatetimeLocalValue,
} from '../src/lib/public-reservations/presentation.ts'

test('public reservation presentation helpers format slot display in JST', () => {
  assert.equal(formatPublicSlotLabel('2026-03-16T01:00:00.000Z'), '03/16 10:00')
  assert.equal(formatPublicSlotTime('2026-03-16T02:30:00.000Z'), '11:30')
  assert.equal(toPublicJstDatetimeLocalValue('2026-03-16T01:00:00.000Z'), '2026-03-16T10:00')
})

test('public reservation presentation helpers build family booking summary and slot message', () => {
  assert.deepEqual(
    buildPublicSubmittedReservationSummary({
      appointmentId: 'appt-1',
      groupId: 'group-1',
      currentGroupId: '',
      petName: 'こむぎ',
      preferredStart: '2026-03-20T10:00',
      status: '予約済',
      fallbackId: 'fallback',
    }),
    {
      appointmentId: 'appt-1',
      groupId: 'group-1',
      petName: 'こむぎ',
      preferredStart: '2026-03-20T10:00',
      status: '予約済',
    }
  )
  assert.equal(
    getPublicSlotMessage({ selectedMenuIds: ['m1'], instantMenuIds: ['m2'] }),
    '選択メニューは即時確定枠の対象外です。希望日時を入力して申請してください。'
  )
  assert.equal(getCancelReservationTokenError(''), '無効なURLです。')
  assert.equal(buildPublicReservePath('store-001'), '/reserve/store-001')
  assert.equal(buildPublicReservePath(' store 002 '), '/reserve/store%20002')
  assert.equal(buildPublicReservePath(''), '/reserve')
})
