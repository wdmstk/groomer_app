import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTrialRolloverBillingOptions } from '../src/lib/cron/services/billing-trial-rollover-core.ts'

test('resolveTrialRolloverBillingOptions uses effective values first', () => {
  const options = resolveTrialRolloverBillingOptions({
    store_id: 's1',
    trial_started_at: '2026-03-01',
    trial_days: 30,
    preferred_provider: 'stripe',
    plan_code: 'standard',
    billing_cycle: 'monthly',
    amount_jpy: 0,
    ai_plan_code_requested: 'assist',
    ai_plan_code_effective: 'pro_plus',
    ai_plan_code: 'none',
    hotel_option_requested: false,
    hotel_option_effective: true,
    hotel_option_enabled: false,
    notification_option_requested: true,
    notification_option_effective: false,
    notification_option_enabled: false,
  })

  assert.deepEqual(options, {
    hotelOptionEnabled: true,
    notificationOptionEnabled: false,
    aiPlanCode: 'pro_plus',
  })
})

test('resolveTrialRolloverBillingOptions falls back to requested/legacy values', () => {
  const options = resolveTrialRolloverBillingOptions({
    store_id: 's2',
    trial_started_at: '2026-03-01',
    trial_days: 30,
    preferred_provider: 'komoju',
    plan_code: 'pro',
    billing_cycle: 'yearly',
    amount_jpy: 0,
    ai_plan_code_requested: 'pro',
    ai_plan_code_effective: null,
    ai_plan_code: 'assist',
    hotel_option_requested: true,
    hotel_option_effective: null,
    hotel_option_enabled: false,
    notification_option_requested: null,
    notification_option_effective: null,
    notification_option_enabled: true,
  })

  assert.deepEqual(options, {
    hotelOptionEnabled: true,
    notificationOptionEnabled: true,
    aiPlanCode: 'pro',
  })
})

test('resolveTrialRolloverBillingOptions disables all options on light plan', () => {
  const options = resolveTrialRolloverBillingOptions({
    store_id: 's3',
    trial_started_at: '2026-03-01',
    trial_days: 30,
    preferred_provider: 'stripe',
    plan_code: 'light',
    billing_cycle: 'monthly',
    amount_jpy: 0,
    ai_plan_code_requested: 'pro_plus',
    ai_plan_code_effective: 'pro_plus',
    ai_plan_code: 'pro_plus',
    hotel_option_requested: true,
    hotel_option_effective: true,
    hotel_option_enabled: true,
    notification_option_requested: true,
    notification_option_effective: true,
    notification_option_enabled: true,
  })

  assert.deepEqual(options, {
    hotelOptionEnabled: false,
    notificationOptionEnabled: false,
    aiPlanCode: 'none',
  })
})
