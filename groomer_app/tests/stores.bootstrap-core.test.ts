import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapStoreCore,
  StoreBootstrapServiceError,
  validateStoreBootstrapInput,
  type StoreBootstrapDeps,
} from '../src/lib/stores/services/bootstrap-core.ts'

test('validateStoreBootstrapInput trims and validates store name', () => {
  assert.equal(validateStoreBootstrapInput('  Groomer Tokyo  '), 'Groomer Tokyo')
  assert.throws(() => validateStoreBootstrapInput(''), /店舗名は必須です/)
})

test('bootstrapStoreCore creates store and owner records', async () => {
  const calls: string[] = []

  const deps: StoreBootstrapDeps = {
    async fetchActiveMembershipRoles() {
      calls.push('fetchRoles')
      return []
    },
    async createStore(storeName) {
      calls.push(`createStore:${storeName}`)
      return { id: 'store-1', name: storeName }
    },
    async upsertTrialSubscription() {
      calls.push('subscription')
    },
    async insertOwnerMembership() {
      calls.push('membership')
    },
    async insertOwnerStaff() {
      calls.push('staff')
    },
    async deleteStore() {
      calls.push('deleteStore')
    },
  }

  const result = await bootstrapStoreCore({
    storeName: '  Groomer Tokyo  ',
    trialDays: 30,
    trialStartedAt: '2026-03-01',
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      user_metadata: { full_name: 'Owner Name' },
    },
    deps,
  })

  assert.equal(result.storeId, 'store-1')
  assert.deepEqual(calls, ['fetchRoles', 'createStore:Groomer Tokyo', 'subscription', 'membership', 'staff'])
})

test('bootstrapStoreCore rejects non-owner users with existing memberships', async () => {
  const deps: StoreBootstrapDeps = {
    async fetchActiveMembershipRoles() {
      return ['staff']
    },
    async createStore() {
      throw new Error('unexpected create')
    },
    async upsertTrialSubscription() {},
    async insertOwnerMembership() {},
    async insertOwnerStaff() {},
    async deleteStore() {},
  }

  await assert.rejects(
    () =>
      bootstrapStoreCore({
        storeName: 'Groomer Tokyo',
        trialDays: 30,
        trialStartedAt: '2026-03-01',
        user: { id: 'user-1', email: 'staff@example.com' },
        deps,
      }),
    (error: unknown) =>
      error instanceof StoreBootstrapServiceError &&
      error.status === 403 &&
      error.message === '新規店舗の作成は owner 権限ユーザーのみ実行できます。'
  )
})
