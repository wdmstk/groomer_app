import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

function createRequest(form: Record<string, string>) {
  const formData = new FormData()
  for (const [k, v] of Object.entries(form)) formData.append(k, v)
  return new Request('http://localhost/api/stores/customer-management-settings', {
    method: 'POST',
    body: formData,
  })
}

function createSupabaseMock(options?: {
  user?: { id: string } | null
  membershipRole?: 'owner' | 'admin' | 'staff' | null
  membershipError?: string | null
}) {
  let lastUpsertPayload: Record<string, unknown> | null = null

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options && 'user' in options ? options.user : { id: 'user-1' } },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: options?.membershipRole
                  ? { role: options.membershipRole }
                  : options?.membershipRole === null
                    ? null
                    : { role: 'owner' },
                error: options?.membershipError ? { message: options.membershipError } : null,
              }),
            }
          },
        }
      }
      return {
        upsert: async (payload: Record<string, unknown>) => {
          lastUpsertPayload = payload
          return { error: null }
        },
      }
    }),
    __getLastUpsertPayload: () => lastUpsertPayload,
  }

  return supabase
}

describe('stores customer-management-settings route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-008
  it('returns 401 when user is not authenticated', async () => {
    const supabase = createSupabaseMock({ user: null })
    createStoreScopedClientMock.mockResolvedValue({ supabase, storeId: 'store-1' })
    const { POST } = await import('../src/app/api/stores/customer-management-settings/route')

    const response = await POST(createRequest({}))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ message: 'Unauthorized' })
  })

  it('returns 403 when membership role is neither owner nor admin', async () => {
    const supabase = createSupabaseMock({ membershipRole: 'staff' })
    createStoreScopedClientMock.mockResolvedValue({ supabase, storeId: 'store-1' })
    const { POST } = await import('../src/app/api/stores/customer-management-settings/route')

    const response = await POST(createRequest({}))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      message: 'この操作は owner/admin のみ実行できます。',
    })
  })

  // TRACE-009
  it('clamps numeric fields and blocks unsafe redirect_to', async () => {
    const supabase = createSupabaseMock({ membershipRole: 'owner' })
    createStoreScopedClientMock.mockResolvedValue({ supabase, storeId: 'store-1' })
    const { POST } = await import('../src/app/api/stores/customer-management-settings/route')

    const response = await POST(
      createRequest({
        redirect_to: '//evil.example',
        medical_record_list_limit: '999',
        journal_visibility_mode: 'unexpected_mode',
        followup_snoozed_refollow_days: '0',
        followup_no_need_refollow_days: '999',
        followup_lost_refollow_days: '-10',
        calendar_expand_out_of_range_appointments: 'true',
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/settings/public-reserve')

    expect(supabase.__getLastUpsertPayload()).toMatchObject({
      store_id: 'store-1',
      medical_record_list_limit: 100,
      journal_visibility_mode: 'published_only',
      calendar_expand_out_of_range_appointments: true,
      followup_snoozed_refollow_days: 1,
      followup_no_need_refollow_days: 365,
      followup_lost_refollow_days: 1,
    })
  })
})
