import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAttendanceEvents } from '../src/lib/staff-shifts/attendance.ts'

test('attendance summary computes work/break minutes', () => {
  const summary = summarizeAttendanceEvents([
    { event_type: 'clock_in', occurred_at: '2026-04-13T09:00:00+09:00' },
    { event_type: 'break_start', occurred_at: '2026-04-13T12:00:00+09:00' },
    { event_type: 'break_end', occurred_at: '2026-04-13T13:00:00+09:00' },
    { event_type: 'clock_out', occurred_at: '2026-04-13T18:00:00+09:00' },
  ])

  assert.equal(summary.break_minutes, 60)
  assert.equal(summary.worked_minutes, 480)
  assert.equal(summary.status, 'complete')
})

test('attendance summary flags invalid break order as review', () => {
  const summary = summarizeAttendanceEvents([
    { event_type: 'break_end', occurred_at: '2026-04-13T10:00:00+09:00' },
    { event_type: 'clock_in', occurred_at: '2026-04-13T09:00:00+09:00' },
    { event_type: 'clock_out', occurred_at: '2026-04-13T18:00:00+09:00' },
  ])

  assert.equal(summary.status, 'needs_review')
  assert.equal(summary.flags.invalid_order, true)
})

test('attendance summary is incomplete when no clock out', () => {
  const summary = summarizeAttendanceEvents([
    { event_type: 'clock_in', occurred_at: '2026-04-13T09:00:00+09:00' },
  ])

  assert.equal(summary.status, 'incomplete')
  assert.equal(summary.flags.missing_clock, true)
})
