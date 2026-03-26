import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConsentToken,
  decodeSignaturePng,
  hashConsentToken,
  noStoreHeaders,
  parseIntWithMin,
  parseString,
} from '../src/lib/consents/shared.ts'

test('createConsentToken generates url-safe random tokens', () => {
  const first = createConsentToken()
  const second = createConsentToken()
  assert.equal(typeof first, 'string')
  assert.equal(typeof second, 'string')
  assert.notEqual(first, second)
  assert.match(first, /^[A-Za-z0-9_-]+$/)
})

test('hashConsentToken is deterministic for the same token', () => {
  const token = 'sample-token'
  assert.equal(hashConsentToken(token), hashConsentToken(token))
})

test('parse helpers normalize values', () => {
  assert.equal(parseString('  abc  '), 'abc')
  assert.equal(parseString('   '), null)
  assert.equal(parseString(123), null)

  assert.equal(parseIntWithMin('12', 1), 12)
  assert.equal(parseIntWithMin('12.7', 1), 12)
  assert.equal(parseIntWithMin('0', 1), null)
  assert.equal(parseIntWithMin('x', 1), null)
})

test('decodeSignaturePng supports data URL and raw base64', () => {
  const raw = Buffer.from('png-bytes').toString('base64')
  const withPrefix = `data:image/png;base64,${raw}`
  assert.equal(decodeSignaturePng(raw).toString('utf8'), 'png-bytes')
  assert.equal(decodeSignaturePng(withPrefix).toString('utf8'), 'png-bytes')
})

test('noStoreHeaders returns anti-cache headers', () => {
  const headers = noStoreHeaders()
  assert.equal(headers['Cache-Control'], 'no-store')
  assert.equal(headers.Pragma, 'no-cache')
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow')
})
