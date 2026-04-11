import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, validateConsentDocumentCreateInputMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  validateConsentDocumentCreateInputMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/consents/documents-core', async () => {
  const actual = await vi.importActual<typeof import('@/lib/consents/documents-core')>('@/lib/consents/documents-core')
  return {
    ...actual,
    validateConsentDocumentCreateInput: validateConsentDocumentCreateInputMock,
  }
})

function createConsentsSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(_table: string) {
      return {
        select() {
          return {
            eq() {
              return this
            },
            order() {
              return this
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }
        },
      }
    },
  }
}

describe('consents routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createConsentsSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-139
  it('POST /api/consents/templates returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/consents/templates/route')
    const response = await POST(
      new Request('http://localhost/api/consents/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'invalid json body.' })
  })

  // TRACE-140
  it('POST /api/consents/templates returns 400 when name is missing', async () => {
    const { POST } = await import('../src/app/api/consents/templates/route')
    const response = await POST(
      new Request('http://localhost/api/consents/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'grooming' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'name is required.' })
  })

  // TRACE-141
  it('POST /api/consents/documents returns 400 when validation fails', async () => {
    validateConsentDocumentCreateInputMock.mockReturnValue({
      ok: false,
      message: 'customer_id is required.',
    })
    const { POST } = await import('../src/app/api/consents/documents/route')
    const response = await POST(
      new Request('http://localhost/api/consents/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'customer_id is required.' })
  })
})
