import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  createAdminSupabaseClientMock,
  requireOwnerStoreMembershipMock,
  fetchStorePlanOptionStateMock,
  isPlanAtLeastMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  requireOwnerStoreMembershipMock: vi.fn(),
  fetchStorePlanOptionStateMock: vi.fn(),
  isPlanAtLeastMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/auth/store-owner', () => ({
  requireOwnerStoreMembership: requireOwnerStoreMembershipMock,
}))

vi.mock('@/lib/store-plan-options', () => ({
  asStorePlanOptionsClient: (supabase: unknown) => supabase,
  fetchStorePlanOptionState: fetchStorePlanOptionStateMock,
}))

vi.mock('@/lib/subscription-plan', () => ({
  isPlanAtLeast: isPlanAtLeastMock,
}))

function createMembershipSupabaseMock(options?: {
  userId?: string | null
  membershipRole?: string | null
  customer?: { id: string; full_name?: string } | null
}) {
  const userId = options && 'userId' in options ? options.userId : 'user-1'
  const membershipRole = options && 'membershipRole' in options ? options.membershipRole : 'owner'
  const customer =
    options && 'customer' in options ? options.customer : { id: 'customer-1', full_name: 'テスト顧客' }

  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
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
              maybeSingle: async () => ({
                data: membershipRole ? { role: membershipRole } : null,
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'customers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: customer, error: null }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('customers/pets/staffs/service-menus routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    fetchStorePlanOptionStateMock.mockResolvedValue({ planCode: 'standard' })
    isPlanAtLeastMock.mockReturnValue(true)
    createAdminSupabaseClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq() {
            return this
          },
          is() {
            return this
          },
          gt() {
            return this
          },
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        update: () => ({
          in: async () => ({ error: null }),
        }),
        insert: async () => ({ error: null }),
      }),
    })
  })

  // TRACE-220
  it('POST /api/customers/[customer_id]/member-portal-link returns 401 when user is unauthenticated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: createMembershipSupabaseMock({ userId: null }),
    })

    const { POST } = await import('../src/app/api/customers/[customer_id]/member-portal-link/route')
    const response = await POST(
      new Request('http://localhost/api/customers/customer-1/member-portal-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ customer_id: 'customer-1' }) }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  // TRACE-221
  it('POST /api/customers/[customer_id]/member-portal-link/revoke returns 404 when customer does not exist', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: createMembershipSupabaseMock({ customer: null }),
    })

    const { POST } = await import('../src/app/api/customers/[customer_id]/member-portal-link/revoke/route')
    const response = await POST(
      new Request('http://localhost/api/customers/customer-404/member-portal-link/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ customer_id: 'customer-404' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '対象顧客が見つかりません。' })
  })

  // TRACE-222
  it('GET /api/pets returns empty array when no pets are found', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                order: async () => ({ data: null, error: null }),
              }
            },
          }
        },
      },
    })

    const { GET } = await import('../src/app/api/pets/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  // TRACE-223
  it('POST /api/pets returns 400 when name is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
        },
      },
    })

    const { POST } = await import('../src/app/api/pets/route')
    const response = await POST(
      new Request('http://localhost/api/pets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer_id: 'customer-1' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'ペット名は必須です。' })
  })

  // TRACE-224
  it('GET /api/staffs returns 500 when query fails', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                order: async () => ({ data: null, error: { message: 'db error' } }),
              }
            },
          }
        },
      },
    })

    const { GET } = await import('../src/app/api/staffs/route')
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'db error' })
  })

  // TRACE-225
  it('PUT /api/staffs/[staff_id] returns 400 when full_name is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {},
    })

    const { PUT } = await import('../src/app/api/staffs/[staff_id]/route')
    const response = await PUT(
      new Request('http://localhost/api/staffs/staff-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: '', role: 'staff' }),
      }),
      { params: Promise.resolve({ staff_id: 'staff-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '氏名は必須です。' })
  })

  // TRACE-226
  it('POST /api/staffs/[staff_id]/chat-access returns 400 when staff user_id is missing', async () => {
    requireOwnerStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                maybeSingle: async () => ({ data: { id: 'staff-1', user_id: null }, error: null }),
              }
            },
          }
        },
      },
    })

    const { POST } = await import('../src/app/api/staffs/[staff_id]/chat-access/route')
    const form = new FormData()
    form.set('can_participate', 'true')
    const response = await POST(
      new Request('http://localhost/api/staffs/staff-1/chat-access', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ staff_id: 'staff-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '対象スタッフの user_id が未設定です。' })
  })

  // TRACE-227
  it('POST /api/service-menus returns 400 when price is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {},
    })

    const form = new FormData()
    form.set('name', 'カット')
    form.set('duration', '60')

    const { POST } = await import('../src/app/api/service-menus/route')
    const response = await POST(
      new Request('http://localhost/api/service-menus', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '価格は必須です。' })
  })

  // TRACE-228
  it('POST /api/service-menus/[menu_id] returns 405 for unsupported _method', async () => {
    const form = new FormData()
    form.set('_method', 'noop')

    const { POST } = await import('../src/app/api/service-menus/[menu_id]/route')
    const response = await POST(
      new Request('http://localhost/api/service-menus/menu-1', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ menu_id: 'menu-1' }) }
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-229
  it('GET /api/service-menus/duration-suggestions returns learned suggestion rows', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        from(table: string) {
          if (table === 'service_menus') {
            return {
              select() {
                return {
                  eq() {
                    return this
                  },
                  order() {
                    return {
                      order: async () => ({
                        data: [{ id: 'menu-1', name: 'カット', duration: 60 }],
                        error: null,
                      }),
                    }
                  },
                }
              },
            }
          }
          if (table === 'appointments') {
            return {
              select() {
                return {
                  eq() {
                    return this
                  },
                  in() {
                    return this
                  },
                  gte() {
                    return this
                  },
                  not: async () => ({
                    data: [
                      { menu: 'カット', duration: 90 },
                      { menu: 'カット', duration: 95 },
                      { menu: 'カット', duration: 92 },
                      { menu: 'カット', duration: 94 },
                      { menu: 'カット', duration: 93 },
                    ],
                    error: null,
                  }),
                }
              },
            }
          }
          throw new Error(`Unexpected table: ${table}`)
        },
      },
    })

    const { GET } = await import('../src/app/api/service-menus/duration-suggestions/route')
    const response = await GET()

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.rows).toHaveLength(1)
    expect(payload.rows[0]).toMatchObject({
      id: 'menu-1',
      name: 'カット',
      currentDuration: 60,
      recommendedDuration: 93,
      sampleCount: 5,
      delta: 33,
    })
  })
})
