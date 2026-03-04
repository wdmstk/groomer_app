import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMinutes,
  normalizeName,
  normalizePublicReservationInput,
  normalizeQrLookupInput,
  toUtcIsoFromJstInput,
  validatePublicReservationInput,
} from '../src/lib/public-reservations/services/shared.ts'

test('normalizePublicReservationInput trims string fields', () => {
  const input = normalizePublicReservationInput({
    customerName: '  Yamada  ',
    petName: '  Pochi ',
    preferredStart: ' 2026-03-01T10:00 ',
    menuIds: ['m1'],
  })

  assert.equal(input.customerName, 'Yamada')
  assert.equal(input.petName, 'Pochi')
  assert.equal(input.preferredStart, '2026-03-01T10:00')
})

test('normalizeName ignores spaces and case', () => {
  assert.equal(normalizeName(' Ya ma da '), 'yamada')
})

test('time helpers convert and add minutes', () => {
  const start = toUtcIsoFromJstInput('2026-03-01T10:00')
  assert.equal(start, '2026-03-01T01:00:00.000Z')
  assert.equal(addMinutes(start!, 90), '2026-03-01T02:30:00.000Z')
})

test('validatePublicReservationInput requires required fields and menus', () => {
  assert.throws(
    () =>
      validatePublicReservationInput({
        customerName: '',
        phoneNumber: '',
        email: '',
        petName: '',
        petBreed: '',
        petGender: '',
        preferredStart: '',
        notes: '',
        qrPayloadText: '',
        menuIds: [],
      }),
    /必須項目を入力してください/
  )
})

test('normalizeQrLookupInput trims qrPayload', () => {
  const input = normalizeQrLookupInput({ qrPayload: '  signed-payload  ' })
  assert.equal(input.qrPayloadText, 'signed-payload')
})
