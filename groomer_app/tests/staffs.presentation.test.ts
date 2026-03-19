import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canCreateMoreStaff,
  formatInviteExpiresAt,
  getStaffMembershipLabel,
} from '../src/lib/staffs/presentation.ts'

test('staff presentation helpers format membership labels and light-plan cap', () => {
  const roleByUserId = new Map([
    ['user-1', 'owner'],
  ])

  assert.equal(
    getStaffMembershipLabel({ userId: 'user-1', canManageRoles: true, roleByUserId }),
    'owner'
  )
  assert.equal(
    getStaffMembershipLabel({ userId: null, canManageRoles: true, roleByUserId }),
    '未連携'
  )
  assert.equal(
    getStaffMembershipLabel({ userId: 'user-2', canManageRoles: false, roleByUserId }),
    '非表示'
  )
  assert.equal(canCreateMoreStaff({ isLightPlan: true, staffCount: 3 }), false)
  assert.equal(canCreateMoreStaff({ isLightPlan: true, staffCount: 2 }), true)
})

test('staff presentation helpers format invite expiry in JST', () => {
  assert.equal(formatInviteExpiresAt('2026-03-16T02:00:00.000Z'), '2026/03/16 11:00')
  assert.equal(formatInviteExpiresAt('bad-value'), '未設定')
})
