import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTrialRolloverBillingOptions } from '../src/lib/cron/services/billing-trial-rollover-core.ts'

test('resolveTrialRolloverBillingOptions uses effective values first', () => {
  const options = resolveTrialRolloverBillingOptions({
    plan_code: 'standard',
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
    plan_code: 'pro',
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
    plan_code: 'light',
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
