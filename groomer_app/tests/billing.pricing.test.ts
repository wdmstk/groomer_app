import test from 'node:test'
import assert from 'node:assert/strict'
import {
  amountForOptions,
  amountForPlanWithStoreCountAndOptions,
  amountForStorageAddonUnits,
  amountForSubscription,
  komojuSubscriptionProductEnvKey,
  stripeSubscriptionPriceEnvKey,
} from '../src/lib/billing/pricing.ts'

test('amountForOptions returns enabled option total for standard monthly plan', () => {
  const amount = amountForOptions('standard', 'monthly', {
    hotelOptionEnabled: true,
    notificationOptionEnabled: true,
  })

  assert.equal(amount, 2000)
})

test('amountForOptions returns zero for light plan even when toggles are true', () => {
  const amount = amountForOptions('light', 'monthly', {
    hotelOptionEnabled: true,
    notificationOptionEnabled: true,
  })

  assert.equal(amount, 0)
})

test('amountForSubscription includes base plan and enabled options', () => {
  const amount = amountForSubscription('pro', 'monthly', {
    hotelOptionEnabled: true,
    notificationOptionEnabled: false,
  })

  assert.equal(amount, 9480)
})

test('amountForStorageAddonUnits converts units to monthly amount', () => {
  assert.equal(amountForStorageAddonUnits(0), 0)
  assert.equal(amountForStorageAddonUnits(3), 900)
})

test('amountForPlanWithStoreCountAndOptions applies store discount before option add-on', () => {
  const amount = amountForPlanWithStoreCountAndOptions('standard', 'monthly', 2, {
    hotelOptionEnabled: true,
    notificationOptionEnabled: true,
  })

  assert.equal(amount, 5184)
})

test('subscription env keys include enabled options and additional suffix', () => {
  assert.equal(
    stripeSubscriptionPriceEnvKey(
      'standard',
      'monthly',
      { hotelOptionEnabled: true, notificationOptionEnabled: true },
      true
    ),
    'STRIPE_PRICE_ID_STANDARD_MONTHLY_HOTEL_NOTIFICATION_ADDITIONAL'
  )
  assert.equal(
    komojuSubscriptionProductEnvKey(
      'pro',
      'yearly',
      { hotelOptionEnabled: false, notificationOptionEnabled: true },
      false
    ),
    'KOMOJU_PRODUCT_ID_PRO_YEARLY_NOTIFICATION'
  )
})
