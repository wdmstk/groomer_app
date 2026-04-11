import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyLineSignatureMock, verifyStripeSignatureMock, verifyKomojuSignatureMock, listActiveProviderWebhookSecretsMock } =
  vi.hoisted(() => ({
    verifyLineSignatureMock: vi.fn(),
    verifyStripeSignatureMock: vi.fn(),
    verifyKomojuSignatureMock: vi.fn(),
    listActiveProviderWebhookSecretsMock: vi.fn(),
  }))

vi.mock('@/lib/line-webhooks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/line-webhooks')>('@/lib/line-webhooks')
  return {
    ...actual,
    verifyLineSignature: verifyLineSignatureMock,
  }
})

vi.mock('@/lib/billing/webhooks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/webhooks')>('@/lib/billing/webhooks')
  return {
    ...actual,
    verifyStripeSignature: verifyStripeSignatureMock,
    verifyKomojuSignature: verifyKomojuSignatureMock,
  }
})

vi.mock('@/lib/billing/provider-connections', () => ({
  listActiveProviderWebhookSecrets: listActiveProviderWebhookSecretsMock,
}))

const originalLineSecret = process.env.LINE_CHANNEL_SECRET
const originalStripeSecret = process.env.STRIPE_WEBHOOK_SECRET
const originalKomojuSecret = process.env.KOMOJU_WEBHOOK_SECRET

describe('webhooks routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.LINE_CHANNEL_SECRET = 'line-secret'
    process.env.STRIPE_WEBHOOK_SECRET = ''
    process.env.KOMOJU_WEBHOOK_SECRET = ''
    listActiveProviderWebhookSecretsMock.mockResolvedValue([])
    verifyLineSignatureMock.mockResolvedValue(false)
    verifyStripeSignatureMock.mockResolvedValue(false)
    verifyKomojuSignatureMock.mockResolvedValue(false)
  })

  afterEach(() => {
    process.env.LINE_CHANNEL_SECRET = originalLineSecret
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeSecret
    process.env.KOMOJU_WEBHOOK_SECRET = originalKomojuSecret
  })

  // TRACE-144
  it('POST /api/webhooks/line returns 400 when signature is invalid', async () => {
    const { POST } = await import('../src/app/api/webhooks/line/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/line', {
        method: 'POST',
        headers: { 'x-line-signature': 'invalid' },
        body: JSON.stringify({ destination: 'dest', events: [] }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid signature' })
  })

  // TRACE-145
  it('POST /api/webhooks/stripe returns 500 when webhook secrets are not configured', async () => {
    const { POST } = await import('../src/app/api/webhooks/stripe/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_1', type: 'invoice.paid' }),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'Missing Stripe webhook secrets' })
  })

  // TRACE-146
  it('POST /api/webhooks/komoju returns 500 when webhook secrets are not configured', async () => {
    const { POST } = await import('../src/app/api/webhooks/komoju/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/komoju', {
        method: 'POST',
        body: JSON.stringify({ id: 'ev_1', type: 'subscription.renewed' }),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'Missing KOMOJU webhook secrets' })
  })
})
