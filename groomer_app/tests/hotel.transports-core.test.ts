import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTransportStatusPatch,
  deriveInitialTransportStatus,
  parseTransportStatus,
  parseTransportType,
} from '../src/lib/hotel/transports.ts'

test('parseTransportType returns pickup/dropoff only', () => {
  assert.equal(parseTransportType('pickup'), 'pickup')
  assert.equal(parseTransportType('dropoff'), 'dropoff')
  assert.equal(parseTransportType('other'), null)
})

test('parseTransportStatus applies fallback', () => {
  assert.equal(parseTransportStatus('arrived', 'pending'), 'arrived')
  assert.equal(parseTransportStatus('x', 'scheduled'), 'scheduled')
})

test('deriveInitialTransportStatus uses scheduled when datetime exists', () => {
  assert.equal(deriveInitialTransportStatus('2026-07-01T00:00:00.000Z'), 'scheduled')
  assert.equal(deriveInitialTransportStatus(null), 'pending')
})

test('buildTransportStatusPatch sets timestamp field by status', () => {
  const now = '2026-07-01T10:00:00.000Z'
  assert.deepEqual(buildTransportStatusPatch({ nextStatus: 'dispatched', nowIso: now }), {
    dispatched_at: now,
  })
  assert.deepEqual(buildTransportStatusPatch({ nextStatus: 'canceled', nowIso: now }), {
    canceled_at: now,
  })
})
