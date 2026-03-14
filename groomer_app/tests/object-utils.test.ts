import test from 'node:test'
import assert from 'node:assert/strict'
import {
  asJsonObject,
  asJsonObjectOrNull,
  asObject,
  asObjectOrNull,
  isObjectRecord,
} from '../src/lib/object-utils.ts'

test('isObjectRecord returns true only for plain object-like values', () => {
  assert.equal(isObjectRecord({ a: 1 }), true)
  assert.equal(isObjectRecord(Object.create(null)), true)
  assert.equal(isObjectRecord([]), false)
  assert.equal(isObjectRecord(null), false)
  assert.equal(isObjectRecord('x'), false)
  assert.equal(isObjectRecord(1), false)
  assert.equal(isObjectRecord(true), false)
})

test('asObjectOrNull returns object or null', () => {
  const obj = { a: 1 }
  assert.equal(asObjectOrNull(obj), obj)
  assert.equal(asObjectOrNull([]), null)
  assert.equal(asObjectOrNull(null), null)
  assert.equal(asObjectOrNull('x'), null)
})

test('asObject returns object or empty object fallback', () => {
  const obj = { a: 1 }
  assert.equal(asObject(obj), obj)
  assert.deepEqual(asObject([]), {})
  assert.deepEqual(asObject(null), {})
  assert.deepEqual(asObject('x'), {})
})

test('asJsonObjectOrNull returns JSON object or null', () => {
  const jsonObj = {
    s: 'x',
    n: 1,
    b: true,
    z: null,
    a: [1, 'x', null],
    o: { nested: 'ok' },
  }

  assert.equal(asJsonObjectOrNull(jsonObj), jsonObj)
  assert.equal(asJsonObjectOrNull([]), null)
  assert.equal(asJsonObjectOrNull(null), null)
  assert.equal(asJsonObjectOrNull(1), null)
})

test('asJsonObject returns JSON object or empty object fallback', () => {
  const jsonObj = { k: 'v' }
  assert.equal(asJsonObject(jsonObj), jsonObj)
  assert.deepEqual(asJsonObject([]), {})
  assert.deepEqual(asJsonObject(null), {})
  assert.deepEqual(asJsonObject(false), {})
})
