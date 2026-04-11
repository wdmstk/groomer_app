import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, requireStoreFeatureAccessMock, isHotelFeatureEnabledForStoreMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  requireStoreFeatureAccessMock: vi.fn(),
  isHotelFeatureEnabledForStoreMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/feature-access', () => ({
  requireStoreFeatureAccess: requireStoreFeatureAccessMock,
}))

vi.mock('@/lib/hotel/feature-gate', () => ({
  isHotelFeatureEnabledForStore: isHotelFeatureEnabledForStoreMock,
}))

function createHotelSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: { role: 'owner' }, error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('hotel routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createHotelSupabaseMock(),
      storeId: 'store-1',
    })
    requireStoreFeatureAccessMock.mockResolvedValue({ ok: true })
    isHotelFeatureEnabledForStoreMock.mockReturnValue(true)
  })

  // TRACE-137
  it('POST /api/hotel/stays returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/hotel/stays/route')
    const response = await POST(
      new Request('http://localhost/api/hotel/stays', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid JSON body.' })
  })

  // TRACE-138
  it('POST /api/hotel/transports returns 400 when stay_id is missing', async () => {
    const { POST } = await import('../src/app/api/hotel/transports/route')
    const response = await POST(
      new Request('http://localhost/api/hotel/transports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          transport_type: 'pickup',
          scheduled_at: '2026-04-11T09:00:00.000Z',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'stay_id is required.' })
  })
})
