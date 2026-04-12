import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock, getStoreIdsByHqCapabilityMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  getStoreIdsByHqCapabilityMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/auth/hq-access', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/hq-access')>('@/lib/auth/hq-access')
  return {
    ...actual,
    getStoreIdsByHqCapability: getStoreIdsByHqCapabilityMock,
  }
})

function createHqSupabaseMock(options?: { authenticated?: boolean }) {
  const authenticated = options?.authenticated ?? true

  return {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: 'user-1' } : null },
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
              then(resolve: (result: { data: Array<{ store_id: string; role: string }>; error: null }) => unknown) {
                return Promise.resolve(resolve({ data: [{ store_id: 'store-1', role: 'owner' }], error: null }))
              },
            }
          },
        }
      }

      if (table === 'store_subscriptions') {
        return {
          select() {
            return {
              in: async () => ({ data: [{ store_id: 'store-1', plan_code: 'pro' }], error: null }),
            }
          },
        }
      }

      if (table === 'hq_menu_template_deliveries') {
        return {
          select() {
            return {
              in() {
                return this
              },
              order() {
                return this
              },
              limit: async () => ({ data: [], error: null }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('hq menu-template routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createServerSupabaseClientMock.mockResolvedValue(createHqSupabaseMock())
    getStoreIdsByHqCapabilityMock.mockReturnValue(['store-1'])
  })

  // TRACE-250
  it('POST /api/hq/menu-templates returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/hq/menu-templates/route')
    const response = await POST(
      new Request('http://localhost/api/hq/menu-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'JSON ボディを指定してください。' })
  })

  // TRACE-251
  it('POST /api/hq/menu-templates returns 400 when targetStoreIds is empty', async () => {
    const { POST } = await import('../src/app/api/hq/menu-templates/route')
    const response = await POST(
      new Request('http://localhost/api/hq/menu-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceStoreId: 'store-1', targetStoreIds: [] }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'targetStoreIds は1件以上必須です。' })
  })

  // TRACE-252
  it('GET /api/hq/menu-template-deliveries returns 401 when not authenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createHqSupabaseMock({ authenticated: false }))
    const { GET } = await import('../src/app/api/hq/menu-template-deliveries/route')
    const response = await GET(new Request('http://localhost/api/hq/menu-template-deliveries'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'ログインが必要です。' })
  })

  // TRACE-379
  it('GET /api/hq/hotel-menu-template-deliveries returns 401 when not authenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createHqSupabaseMock({ authenticated: false }))
    const { GET } = await import('../src/app/api/hq/hotel-menu-template-deliveries/route')
    const response = await GET(new Request('http://localhost/api/hq/hotel-menu-template-deliveries'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'ログインが必要です。' })
  })

  // TRACE-380
  it('GET /api/hq/hotel-menu-templates returns 401 when not authenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createHqSupabaseMock({ authenticated: false }))
    const { GET } = await import('../src/app/api/hq/hotel-menu-templates/route')
    const response = await GET(new Request('http://localhost/api/hq/hotel-menu-templates'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'ログインが必要です。' })
  })

  // TRACE-378
  it('POST /api/hq/hotel-menu-template-deliveries/[delivery_id]/approve returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/hq/hotel-menu-template-deliveries/[delivery_id]/approve/route')
    const response = await POST(
      new Request('http://localhost/api/hq/hotel-menu-template-deliveries/delivery-1/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: Promise.resolve({ delivery_id: 'delivery-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'JSON ボディを指定してください。' })
  })

  // TRACE-381
  it('POST /api/hq/menu-template-deliveries/[delivery_id]/approve returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/hq/menu-template-deliveries/[delivery_id]/approve/route')
    const response = await POST(
      new Request('http://localhost/api/hq/menu-template-deliveries/delivery-1/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: Promise.resolve({ delivery_id: 'delivery-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'JSON ボディを指定してください。' })
  })
})
