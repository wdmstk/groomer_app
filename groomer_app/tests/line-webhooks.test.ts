import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyLineSignature } from '../src/lib/line-webhooks.ts'

test('verifyLineSignature returns true for a valid signature', async () => {
  const payload = JSON.stringify({ destination: 'dest', events: [{ type: 'follow' }] })
  const secret = 'test-secret'
  const header = createHmac('sha256', secret).update(payload).digest('base64')

  const valid = await verifyLineSignature({
    payload,
    header,
    secret,
  })

  assert.equal(valid, true)
})

test('verifyLineSignature returns false for an invalid signature', async () => {
  const valid = await verifyLineSignature({
    payload: '{"events":[]}',
    header: 'invalid-signature',
    secret: 'test-secret',
  })

  assert.equal(valid, false)
})
