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

describe('hq kpi summary route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-155
  it('GET /api/hq/kpi-summary returns 401 when not authenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    })

    const { GET } = await import('../src/app/api/hq/kpi-summary/route')
    const response = await GET(new Request('http://localhost/api/hq/kpi-summary'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'ログインが必要です。' })
  })

  // TRACE-156
  it('GET /api/hq/kpi-summary returns 403 when no HQ-capable stores', async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } } }),
      },
      from: () => ({
        select() {
          return {
            eq() {
              return this
            },
          }
        },
      }),
    })
    getStoreIdsByHqCapabilityMock.mockReturnValue([])

    const { GET } = await import('../src/app/api/hq/kpi-summary/route')
    const response = await GET(new Request('http://localhost/api/hq/kpi-summary'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: 'Proプランの owner/admin 所属店舗がありません。',
    })
  })
})
