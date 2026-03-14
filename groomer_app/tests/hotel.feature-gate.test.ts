import test from 'node:test'
import assert from 'node:assert/strict'
import { isHotelFeatureEnabledForStore } from '../src/lib/hotel/feature-gate.ts'

test('isHotelFeatureEnabledForStore respects explicit store allowlist', () => {
  process.env.HOTEL_ENABLED_STORE_IDS = 'store-a, store-b'
  assert.equal(isHotelFeatureEnabledForStore('store-a'), true)
  assert.equal(isHotelFeatureEnabledForStore('store-c'), false)
})

test('isHotelFeatureEnabledForStore supports wildcard', () => {
  process.env.HOTEL_ENABLED_STORE_IDS = '*'
  assert.equal(isHotelFeatureEnabledForStore('any-store'), true)
})

test('isHotelFeatureEnabledForStore disables when env is empty', () => {
  delete process.env.HOTEL_ENABLED_STORE_IDS
  assert.equal(isHotelFeatureEnabledForStore('store-a'), false)
})
