import assert from 'node:assert/strict'
import test from 'node:test'
import { isDevBillingBypassEnabled } from '../src/lib/billing/dev-bypass.ts'

test('isDevBillingBypassEnabled returns false in production', () => {
  const before = process.env.NODE_ENV
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  assert.equal(isDevBillingBypassEnabled(), false)
  ;(process.env as Record<string, string | undefined>).NODE_ENV = before
})

test('isDevBillingBypassEnabled returns true outside production', () => {
  const before = process.env.NODE_ENV
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
  assert.equal(isDevBillingBypassEnabled(), true)
  ;(process.env as Record<string, string | undefined>).NODE_ENV = before
})
