import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateMenuSummary,
  toUtcIsoFromJstInput,
  validateAppointmentWriteInput,
} from '../src/lib/appointments/services/shared.ts'

test('toUtcIsoFromJstInput converts JST local datetime to UTC iso', () => {
  assert.equal(toUtcIsoFromJstInput('2026-03-01T10:00'), '2026-03-01T01:00:00.000Z')
})

test('calculateMenuSummary merges names and duration', () => {
  const summary = calculateMenuSummary([
    { id: 'm1', name: 'Bath', price: 1000, duration: 30, tax_rate: null, tax_included: null },
    { id: 'm2', name: 'Cut', price: 2000, duration: 45, tax_rate: null, tax_included: null },
  ])

  assert.equal(summary.names, 'Bath / Cut')
  assert.equal(summary.duration, 75)
})

test('validateAppointmentWriteInput rejects missing menu ids', () => {
  assert.throws(
    () =>
      validateAppointmentWriteInput({
        customerId: 'cust-1',
        petId: 'pet-1',
        staffId: 'staff-1',
        startTimeIso: '2026-03-01T01:00:00.000Z',
        endTimeIso: '2026-03-01T02:00:00.000Z',
        menuIds: [],
        status: '予約済',
        notes: null,
      }),
    /予約メニューの選択は必須です/
  )
})
