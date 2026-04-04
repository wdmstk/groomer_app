import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeMemberPortalTtlDays,
  resolveMemberPortalEffectiveExpiresAt,
} from '../src/lib/member-portal.ts'

test('normalizeMemberPortalTtlDays accepts only 30/90/180', () => {
  assert.equal(normalizeMemberPortalTtlDays(30), 30)
  assert.equal(normalizeMemberPortalTtlDays(90), 90)
  assert.equal(normalizeMemberPortalTtlDays(180), 180)
  assert.equal(normalizeMemberPortalTtlDays(120), 90)
  assert.equal(normalizeMemberPortalTtlDays(null), 90)
})

test('resolveMemberPortalEffectiveExpiresAt uses issued_at anchor when no visit exists', () => {
  const expiresAt = resolveMemberPortalEffectiveExpiresAt({
    issuedAt: '2026-01-01T00:00:00.000Z',
    currentExpiresAt: '2026-01-15T00:00:00.000Z',
    latestVisitAt: null,
    ttlDays: 90,
  })

  assert.equal(expiresAt, '2026-04-01T00:00:00.000Z')
})

test('resolveMemberPortalEffectiveExpiresAt extends by latest visit anchor', () => {
  const expiresAt = resolveMemberPortalEffectiveExpiresAt({
    issuedAt: '2026-01-01T00:00:00.000Z',
    currentExpiresAt: '2026-04-01T00:00:00.000Z',
    latestVisitAt: '2026-03-15T00:00:00.000Z',
    ttlDays: 90,
  })

  assert.equal(expiresAt, '2026-06-13T00:00:00.000Z')
})

test('resolveMemberPortalEffectiveExpiresAt keeps longer current expiry', () => {
  const expiresAt = resolveMemberPortalEffectiveExpiresAt({
    issuedAt: '2026-01-01T00:00:00.000Z',
    currentExpiresAt: '2026-12-31T00:00:00.000Z',
    latestVisitAt: '2026-03-15T00:00:00.000Z',
    ttlDays: 90,
  })

  assert.equal(expiresAt, '2026-12-31T00:00:00.000Z')
})
