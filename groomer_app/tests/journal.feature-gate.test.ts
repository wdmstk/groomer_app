import test from 'node:test'
import assert from 'node:assert/strict'
import { isJournalFeatureEnabledForStore } from '../src/lib/journal/feature-gate.ts'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev = new Map<string, string | undefined>()
  for (const key of Object.keys(vars)) {
    prev.set(key, process.env[key])
    const next = vars[key]
    if (typeof next === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = next
    }
  }
  try {
    fn()
  } finally {
    for (const [key, value] of prev.entries()) {
      if (typeof value === 'undefined') delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('feature gate allows all in non-production when env is unset', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      JOURNAL_ENABLED_STORE_IDS: undefined,
    },
    () => {
      assert.equal(isJournalFeatureEnabledForStore('store-1'), true)
    }
  )
})

test('feature gate blocks in production when env is unset', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      JOURNAL_ENABLED_STORE_IDS: undefined,
    },
    () => {
      assert.equal(isJournalFeatureEnabledForStore('store-1'), false)
    }
  )
})

test('feature gate respects allowlist and wildcard', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      JOURNAL_ENABLED_STORE_IDS: 'store-a,store-b',
    },
    () => {
      assert.equal(isJournalFeatureEnabledForStore('store-a'), true)
      assert.equal(isJournalFeatureEnabledForStore('store-z'), false)
    }
  )

  withEnv(
    {
      NODE_ENV: 'production',
      JOURNAL_ENABLED_STORE_IDS: '*',
    },
    () => {
      assert.equal(isJournalFeatureEnabledForStore('store-any'), true)
    }
  )
})
