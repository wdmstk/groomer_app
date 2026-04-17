import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isOverlappingRange,
  parseDateKeyList,
  parseWeekdayList,
  parseWorkRuleSlots,
} from '../src/lib/staff-shifts/shared.ts'

test('staff shift helpers parse weekday/date lists', () => {
  assert.deepEqual(parseWeekdayList('1, 2,9,2,0'), [0, 1, 2])
  assert.deepEqual(parseDateKeyList('2026-04-13\ninvalid\n2026-04-14\n2026-04-13'), [
    '2026-04-13',
    '2026-04-14',
  ])
})

test('staff shift helpers parse availability slots', () => {
  assert.deepEqual(parseWorkRuleSlots('1:09:00-18:00\n2:10:00-19:00\n3:18:00-09:00'), [
    { weekday: 1, start_time: '09:00', end_time: '18:00' },
    { weekday: 2, start_time: '10:00', end_time: '19:00' },
  ])
})

test('staff shift helpers evaluate overlaps', () => {
  assert.equal(
    isOverlappingRange(
      '2026-04-13T10:00:00+09:00',
      '2026-04-13T11:00:00+09:00',
      '2026-04-13T10:30:00+09:00',
      '2026-04-13T12:00:00+09:00'
    ),
    true
  )
  assert.equal(
    isOverlappingRange(
      '2026-04-13T10:00:00+09:00',
      '2026-04-13T11:00:00+09:00',
      '2026-04-13T11:00:00+09:00',
      '2026-04-13T12:00:00+09:00'
    ),
    false
  )
})
