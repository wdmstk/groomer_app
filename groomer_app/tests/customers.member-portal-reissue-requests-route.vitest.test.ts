import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, createAdminSupabaseClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

function createStoreSupabaseMock(options?: {
  userId?: string | null
  membership: { role: 'owner' | 'admin' | 'staff' } | null
}) {
  const userId = options && 'userId' in options ? options.userId : 'user-1'
  const membership = options?.membership ?? { role: 'owner' as const }

  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from(table: string) {
      if (table !== 'store_memberships') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: membership, error: null }),
          }
        },
      }
    },
  }
}

function createAdminSupabaseMock(pendingRow?: {
  id: string
  status: string
  requested_at: string | null
  request_note: string | null
} | null) {
  return {
    from(table: string) {
      if (table !== 'member_portal_reissue_requests') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq() {
              return this
            },
            order() {
              return this
            },
            limit() {
              return this
            },
            maybeSingle: async () => ({ data: pendingRow ?? null, error: null }),
          }
        },
      }
    },
  }
}

function buildParams(customerId = 'customer-1') {
  return { params: Promise.resolve({ customer_id: customerId }) }
}

describe('customers/[customer_id]/member-portal-reissue-requests route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreSupabaseMock(),
      storeId: 'store-1',
    })
    createAdminSupabaseClientMock.mockReturnValue(createAdminSupabaseMock(null))
  })

  // TRACE-101
  it('returns 401 when user is unauthenticated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreSupabaseMock({ userId: null, membership: null }),
      storeId: 'store-1',
    })

    const { GET } = await import(
      '../src/app/api/customers/[customer_id]/member-portal-reissue-requests/route'
    )
    const response = await GET(new Request('http://localhost/api/customers/customer-1/member-portal-reissue-requests'), buildParams())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ message: 'Unauthorized' })
  })

  // TRACE-102
  it('returns mapped pendingRequest payload when pending row exists', async () => {
    createAdminSupabaseClientMock.mockReturnValue(
      createAdminSupabaseMock({
        id: 'req-1',
        status: 'pending',
        requested_at: '2026-04-11T00:00:00.000Z',
        request_note: 'URLが見つからない',
      })
    )

    const { GET } = await import(
      '../src/app/api/customers/[customer_id]/member-portal-reissue-requests/route'
    )
    const response = await GET(new Request('http://localhost/api/customers/customer-1/member-portal-reissue-requests'), buildParams())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      pendingRequest: {
        id: 'req-1',
        status: 'pending',
        requestedAt: '2026-04-11T00:00:00.000Z',
        note: 'URLが見つからない',
      },
    })
  })
})
