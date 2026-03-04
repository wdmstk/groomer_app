import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptStoreInviteCore,
  type StoreInviteAcceptDeps,
} from '../src/lib/store-invites/services/accept-core.ts'

test('acceptStoreInviteCore consumes invite after duplicate staff email fallback', async () => {
  const staffUpdates: Array<{ staffId: string; payload: Record<string, unknown> }> = []
  const membershipCalls: Array<{ storeId: string; userId: string; role: string }> = []
  const consumedInvites: Array<{ inviteId: string; usedAt: string; usedBy: string }> = []

  const deps: StoreInviteAcceptDeps = {
    async fetchInviteByToken() {
      return {
        id: 'invite-1',
        store_id: 'store-1',
        email: 'user@example.com',
        role: 'staff',
        expires_at: '2026-12-31T00:00:00.000Z',
        used_at: null,
      }
    },
    async upsertMembership(params) {
      membershipCalls.push(params)
    },
    async findStaffByUserId() {
      return null
    },
    async findStaffByEmail() {
      return { id: 'staff-1', full_name: '' }
    },
    async updateStaffById({ staffId, payload }) {
      staffUpdates.push({ staffId, payload })
      if (staffUpdates.length === 1) {
        throw { code: '23505', message: 'duplicate key value violates unique constraint "staffs_email_key"' }
      }
    },
    async insertStaff() {
      throw new Error('unexpected insert')
    },
    async consumeInvite(params) {
      consumedInvites.push(params)
    },
  }

  const result = await acceptStoreInviteCore({
    token: 'token-1',
    nowIso: '2026-03-01T00:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'USER@example.com',
      user_metadata: { full_name: '  Yamada Taro  ' },
    },
    deps,
  })

  assert.equal(result.storeId, 'store-1')
  assert.deepEqual(membershipCalls, [{ storeId: 'store-1', userId: 'user-1', role: 'staff' }])
  assert.equal(staffUpdates.length, 2)
  assert.deepEqual(staffUpdates[1], {
    staffId: 'staff-1',
    payload: {
      user_id: 'user-1',
      email: null,
      role: 'staff',
      full_name: 'Yamada Taro',
    },
  })
  assert.deepEqual(consumedInvites, [
    { inviteId: 'invite-1', usedAt: '2026-03-01T00:00:00.000Z', usedBy: 'user-1' },
  ])
})
