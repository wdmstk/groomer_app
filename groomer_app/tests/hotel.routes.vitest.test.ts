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

function createHotelSupabaseMock(options?: { role?: string; authenticated?: boolean }) {
  const role = options?.role ?? 'owner'
  const authenticated = options?.authenticated ?? true
  return {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: 'user-1' } : null },
        error: null,
      }),
    },
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: { role }, error: null }),
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

  // TRACE-240
  it('POST /api/hotel/menu-items returns 401 when unauthenticated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createHotelSupabaseMock({ authenticated: false }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/hotel/menu-items/route')
    const response = await POST(
      new Request('http://localhost/api/hotel/menu-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '送迎オプション' }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  // TRACE-241
  it('POST /api/hotel/menu-items/season-toggle returns 400 for invalid season_mode', async () => {
    const { POST } = await import('../src/app/api/hotel/menu-items/season-toggle/route')
    const response = await POST(
      new Request('http://localhost/api/hotel/menu-items/season-toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season_mode: 'summer' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'season_mode must be normal or high_season.',
    })
  })

  // TRACE-242
  it('PATCH /api/hotel/settings returns 400 for invalid JSON body', async () => {
    const { PATCH } = await import('../src/app/api/hotel/settings/route')
    const response = await PATCH(
      new Request('http://localhost/api/hotel/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid JSON body.' })
  })

  // TRACE-243
  it('POST /api/hotel/stays/[stay_id]/report-line returns 400 when report_body is missing', async () => {
    const { POST } = await import('../src/app/api/hotel/stays/[stay_id]/report-line/route')
    const response = await POST(
      new Request('http://localhost/api/hotel/stays/stay-1/report-line', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_body: '   ' }),
      }),
      { params: Promise.resolve({ stay_id: 'stay-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'report_body is required.' })
  })

  // TRACE-244
  it('DELETE /api/hotel/transports/[transport_id] returns 403 for non owner/admin role', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createHotelSupabaseMock({ role: 'staff' }),
      storeId: 'store-1',
    })
    const { DELETE } = await import('../src/app/api/hotel/transports/[transport_id]/route')
    const response = await DELETE(
      new Request('http://localhost/api/hotel/transports/transport-1', { method: 'DELETE' }),
      { params: Promise.resolve({ transport_id: 'transport-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: 'Only owner/admin can delete transport rows.',
    })
  })
})
