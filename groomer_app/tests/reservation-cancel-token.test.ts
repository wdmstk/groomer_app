import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createReservationCancelToken,
  verifyReservationCancelToken,
} from '../src/lib/reservation-cancel-token.ts'

test('reservation cancel token preserves optional groupId', () => {
  process.env.RESERVATION_CANCEL_SECRET = 'test-secret'

  const token = createReservationCancelToken({
    appointmentId: 'appointment-1',
    groupId: 'group-1',
    storeId: 'store-1',
    expiresInSeconds: 3600,
  })

  const verified = verifyReservationCancelToken(token)
  assert.equal(verified.valid, true)
  if (!verified.valid) return

  assert.equal(verified.payload.appointmentId, 'appointment-1')
  assert.equal(verified.payload.groupId, 'group-1')
  assert.equal(verified.payload.storeId, 'store-1')
})
