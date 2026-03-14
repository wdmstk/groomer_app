import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canRoleUseHqCapability,
  getManageableRoleByStoreId,
  getStoreIdsByHqCapability,
  type MembershipRow,
} from '../src/lib/auth/hq-access.ts'

test('canRoleUseHqCapability enforces owner/admin/staff matrix', () => {
  assert.equal(canRoleUseHqCapability('owner', 'hq_view'), true)
  assert.equal(canRoleUseHqCapability('owner', 'hq_template_request'), true)
  assert.equal(canRoleUseHqCapability('owner', 'hq_template_approve'), true)

  assert.equal(canRoleUseHqCapability('admin', 'hq_view'), true)
  assert.equal(canRoleUseHqCapability('admin', 'hq_template_request'), false)
  assert.equal(canRoleUseHqCapability('admin', 'hq_template_approve'), false)

  assert.equal(canRoleUseHqCapability('staff', 'hq_view'), false)
  assert.equal(canRoleUseHqCapability('staff', 'hq_template_request'), false)
  assert.equal(canRoleUseHqCapability('staff', 'hq_template_approve'), false)
})

test('getStoreIdsByHqCapability filters stores by capability', () => {
  const memberships: MembershipRow[] = [
    { store_id: 'store-owner', role: 'owner' },
    { store_id: 'store-admin', role: 'admin' },
    { store_id: 'store-staff', role: 'staff' },
  ]

  assert.deepEqual(getStoreIdsByHqCapability(memberships, 'hq_view'), [
    'store-owner',
    'store-admin',
  ])
  assert.deepEqual(getStoreIdsByHqCapability(memberships, 'hq_template_request'), ['store-owner'])
  assert.deepEqual(getStoreIdsByHqCapability(memberships, 'hq_template_approve'), ['store-owner'])
})

test('getManageableRoleByStoreId returns role map scoped by capability', () => {
  const memberships: MembershipRow[] = [
    { store_id: 'store-owner', role: 'owner' },
    { store_id: 'store-admin', role: 'admin' },
    { store_id: 'store-staff', role: 'staff' },
  ]

  const approvalMap = getManageableRoleByStoreId(memberships, 'hq_template_approve')
  assert.equal(approvalMap.get('store-owner'), 'owner')
  assert.equal(approvalMap.has('store-admin'), false)
  assert.equal(approvalMap.has('store-staff'), false)

  const viewMap = getManageableRoleByStoreId(memberships, 'hq_view')
  assert.equal(viewMap.get('store-owner'), 'owner')
  assert.equal(viewMap.get('store-admin'), 'admin')
  assert.equal(viewMap.has('store-staff'), false)
})
