import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeStatus,
  validateMedicalRecordWriteInput,
} from '../src/lib/medical-records/services/shared.ts'

test('normalizeStatus returns finalized only for finalized input', () => {
  assert.equal(normalizeStatus('finalized'), 'finalized')
  assert.equal(normalizeStatus('draft'), 'draft')
  assert.equal(normalizeStatus(null), 'draft')
})

test('validateMedicalRecordWriteInput rejects missing required fields', () => {
  assert.throws(
    () =>
      validateMedicalRecordWriteInput({
        petId: null,
        staffId: 'staff-1',
        appointmentId: 'appt-1',
        requestedPaymentId: null,
        status: 'draft',
        recordDate: '2026-03-01',
        menu: 'Trim',
        duration: null,
        shampooUsed: null,
        skinCondition: null,
        behaviorNotes: null,
        cautionNotes: null,
        photoDrafts: [],
      }),
    /ペットの選択は必須です/
  )
})
