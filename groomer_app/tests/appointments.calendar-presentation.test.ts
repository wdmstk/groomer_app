import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCalendarConflictJst,
  isRequestedAppointmentStatus,
  parseCalendarDelayAlertPayload,
} from '../src/lib/appointments/calendar-presentation.ts'

test('calendar presentation helpers parse delay alert with impacted pet summary', () => {
  const parsed = parseCalendarDelayAlertPayload(
    JSON.stringify({
      baseEndTime: '2026-03-16T02:00:00.000Z',
      scenarios: [
        {
          offsetMin: 15,
          impactedCount: 2,
          impacts: [
            {
              startTime: '2026-03-16T02:15:00.000Z',
              customerName: '佐藤 愛',
              petName: 'こむぎ',
            },
          ],
        },
      ],
    })
  )

  assert.deepEqual(parsed, {
    baseEndTime: '2026-03-16T02:00:00.000Z',
    lines: ['+15分: 2件影響 (11:15 こむぎ (佐藤 愛))'],
  })
})

test('calendar presentation helpers format conflict and requested status', () => {
  assert.equal(formatCalendarConflictJst('2026-03-16T02:00:00.000Z'), '03/16 11:00')
  assert.equal(formatCalendarConflictJst('bad-value'), '-')
  assert.equal(isRequestedAppointmentStatus('予約申請'), true)
  assert.equal(isRequestedAppointmentStatus('予約済'), false)
})
