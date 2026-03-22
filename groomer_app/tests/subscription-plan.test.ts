import assert from 'node:assert/strict'
import test from 'node:test'
import { requiredOptionForRoute } from '../src/lib/subscription-plan.ts'

test('requiredOptionForRoute keeps existing HQ template routes without hotel gate', () => {
  assert.equal(requiredOptionForRoute('/hq/menu-templates'), null)
  assert.equal(requiredOptionForRoute('/hq/menu-template-deliveries'), null)
})

test('requiredOptionForRoute requires hotel option for HQ hotel template routes', () => {
  assert.equal(requiredOptionForRoute('/hq/hotel-menu-templates'), 'hotel')
  assert.equal(requiredOptionForRoute('/hq/hotel-menu-template-deliveries'), 'hotel')
})
