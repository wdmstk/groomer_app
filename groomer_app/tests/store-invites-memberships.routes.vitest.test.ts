import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  createServerSupabaseClientMock,
  setActiveStoreIdCookieMock,
  acceptStoreInviteMock,
  fetchStorePlanOptionStateMock,
  isPlanAtLeastMock,
  randomUUIDMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createServerSupabaseClientMock: vi.fn(),
  setActiveStoreIdCookieMock: vi.fn(),
  acceptStoreInviteMock: vi.fn(),
  fetchStorePlanOptionStateMock: vi.fn(),
  isPlanAtLeastMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}))

class MockStoreInviteAcceptServiceError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return {
    ...actual,
    randomUUID: randomUUIDMock,
  }
})

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
  setActiveStoreIdCookie: setActiveStoreIdCookieMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/store-invites/services/accept', () => ({
  acceptStoreInvite: acceptStoreInviteMock,
  StoreInviteAcceptServiceError: MockStoreInviteAcceptServiceError,
}))

vi.mock('@/lib/store-plan-options', () => ({
  asStorePlanOptionsClient: (client: unknown) => client,
  fetchStorePlanOptionState: fetchStorePlanOptionStateMock,
}))

vi.mock('@/lib/subscription-plan', () => ({
  isPlanAtLeast: isPlanAtLeastMock,
}))

function createStoreInvitesSupabase(options?: {
  user?: { id: string } | null
  role?: string | null
  insertError?: { message: string } | null
}) {
  const user = options?.user ?? { id: 'user-1' }
  const role = options?.role ?? 'owner'

  return {
    auth: {
      getUser: async () => ({
        data: { user },
        error: user ? null : { message: 'unauthorized' },
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
                data: role ? { role } : null,
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'store_invites') {
        return {
          insert: async () => ({ error: options?.insertError ?? null }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function createStoreMembershipsRoleSupabase(options?: {
  user?: { id: string } | null
  actorRole?: 'owner' | 'admin' | 'staff' | null
  targetMembership?: { id: string; user_id: string; role: 'owner' | 'admin' | 'staff' } | null
  ownerCount?: number
  updateError?: { message: string } | null
}) {
  const user = options?.user ?? { id: 'owner-1' }
  const actorRole = options?.actorRole ?? 'owner'
  const targetMembership =
    options?.targetMembership ??
    ({ id: 'm-2', user_id: 'u-2', role: 'staff' } as const)
  const ownerCount = options?.ownerCount ?? 2

  return {
    auth: {
      getUser: async () => ({
        data: { user },
        error: user ? null : { message: 'unauthorized' },
      }),
    },
    from(table: string) {
      if (table !== 'store_memberships') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select(columns: string, opts?: { count?: 'exact'; head?: boolean }) {
          if (opts?.count === 'exact' && opts?.head) {
            const query = {
              eq() {
                return query
              },
              then(resolve: (value: { count: number; error: null }) => unknown) {
                return Promise.resolve(resolve({ count: ownerCount, error: null }))
              },
            }
            return query
          }

          if (columns === 'role') {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: actorRole ? { role: actorRole } : null,
                error: null,
              }),
            }
          }

          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: targetMembership, error: null }),
          }
        },
        update() {
          const query = {
            eq() {
              return query
            },
            then(resolve: (value: { error: { message: string } | null }) => unknown) {
              return Promise.resolve(resolve({ error: options?.updateError ?? null }))
            },
          }
          return query
        },
      }
    },
  }
}

describe('store invite and membership routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    randomUUIDMock.mockReturnValue('token-123')
    setActiveStoreIdCookieMock.mockResolvedValue(undefined)
    acceptStoreInviteMock.mockResolvedValue({
      storeId: 'store-1',
      membershipId: 'membership-1',
    })
    fetchStorePlanOptionStateMock.mockResolvedValue({ planCode: 'standard' })
    isPlanAtLeastMock.mockReturnValue(true)

    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreInvitesSupabase(),
      storeId: 'store-1',
    })

    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'u-1', email: 'owner@example.com' } },
          error: null,
        }),
      },
    })
  })

  // TRACE-183
  it('POST /api/store-invites/accept returns 400 when token is missing', async () => {
    const { POST } = await import('../src/app/api/store-invites/accept/route')

    const response = await POST(
      new Request('http://localhost/api/store-invites/accept', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '招待トークンが必要です。',
    })
  })

  // TRACE-184
  it('POST /api/store-invites/accept maps service error status and message', async () => {
    acceptStoreInviteMock.mockRejectedValueOnce(
      new MockStoreInviteAcceptServiceError('期限切れです。', 410)
    )

    const { POST } = await import('../src/app/api/store-invites/accept/route')

    const response = await POST(
      new Request('http://localhost/api/store-invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'token-1' }),
      })
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({ message: '期限切れです。' })
  })

  // TRACE-185
  it('POST /api/store-invites returns 400 when invite role is invalid', async () => {
    const { POST } = await import('../src/app/api/store-invites/route')

    const response = await POST(
      new Request('http://localhost/api/store-invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'staff@example.com', role: 'owner' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '招待可能ロールは admin / staff のみです。',
    })
  })

  // TRACE-186
  it('POST /api/store-invites returns inviteUrl on success', async () => {
    const { POST } = await import('../src/app/api/store-invites/route')

    const response = await POST(
      new Request('http://localhost/api/store-invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'staff@example.com', role: 'staff' }),
      })
    )

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.message).toBe('招待リンクを作成しました。')
    expect(json.inviteUrl).toMatch(/^http:\/\/localhost\/invite\/.+/)
  })

  // TRACE-187
  it('PATCH /api/store-memberships/[membership_id]/role returns 403 on light plan', async () => {
    fetchStorePlanOptionStateMock.mockResolvedValueOnce({ planCode: 'light' })
    isPlanAtLeastMock.mockReturnValueOnce(false)

    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createStoreMembershipsRoleSupabase(),
      storeId: 'store-1',
    })

    const { PATCH } = await import(
      '../src/app/api/store-memberships/[membership_id]/role/route'
    )

    const response = await PATCH(
      new Request('http://localhost/api/store-memberships/m-1/role', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      }),
      { params: Promise.resolve({ membership_id: 'm-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message:
        'ライトプランでは権限変更は利用できません。スタンダード以上で利用できます。',
    })
  })

  // TRACE-188
  it('PATCH /api/store-memberships/[membership_id]/role returns 400 for invalid role', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createStoreMembershipsRoleSupabase(),
      storeId: 'store-1',
    })

    const { PATCH } = await import(
      '../src/app/api/store-memberships/[membership_id]/role/route'
    )

    const response = await PATCH(
      new Request('http://localhost/api/store-memberships/m-1/role', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'guest' }),
      }),
      { params: Promise.resolve({ membership_id: 'm-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'ロールは owner/admin/staff のみ指定できます。',
    })
  })

  // TRACE-189
  it('PATCH /api/store-memberships/[membership_id]/role rejects changing the last owner', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createStoreMembershipsRoleSupabase({
        targetMembership: { id: 'm-owner', user_id: 'u-owner', role: 'owner' },
        ownerCount: 1,
      }),
      storeId: 'store-1',
    })

    const { PATCH } = await import(
      '../src/app/api/store-memberships/[membership_id]/role/route'
    )

    const response = await PATCH(
      new Request('http://localhost/api/store-memberships/m-owner/role', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      }),
      { params: Promise.resolve({ membership_id: 'm-owner' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '最後の owner は変更できません。',
    })
  })

  // TRACE-190
  it('PATCH /api/store-memberships/[membership_id]/role returns 200 on successful role update', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      supabase: createStoreMembershipsRoleSupabase(),
      storeId: 'store-1',
    })

    const { PATCH } = await import(
      '../src/app/api/store-memberships/[membership_id]/role/route'
    )

    const response = await PATCH(
      new Request('http://localhost/api/store-memberships/m-1/role', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      }),
      { params: Promise.resolve({ membership_id: 'm-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'ロールを更新しました。' })
  })
})
