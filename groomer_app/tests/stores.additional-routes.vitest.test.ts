import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock, createStoreScopedClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
  setActiveStoreIdCookie: vi.fn(async () => undefined),
}))

vi.mock('@/lib/stores/services/bootstrap', () => ({
  bootstrapStore: vi.fn(async () => ({ storeId: 'store-1' })),
  StoreBootstrapServiceError: class StoreBootstrapServiceError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

describe('stores additional routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-278
  it('POST /api/stores/bootstrap returns 401 when user is not authenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: null,
        }),
      },
    })

    const { POST } = await import('../src/app/api/stores/bootstrap/route')
    const response = await POST(
      new Request('http://localhost/api/stores/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeName: 'My Store' }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  // TRACE-279
  it('POST /api/stores/public-reserve-blocked-dates returns 401 when user is not authenticated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        auth: {
          getUser: async () => ({
            data: { user: null },
          }),
        },
      },
    })

    const form = new FormData()
    form.set('blocked_dates_jst', '2026-04-12')
    const { POST } = await import('../src/app/api/stores/public-reserve-blocked-dates/route')
    const response = await POST(
      new Request('http://localhost/api/stores/public-reserve-blocked-dates', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })
})
