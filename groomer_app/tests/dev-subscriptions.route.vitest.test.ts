import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireDeveloperAdminMock, createClientMock } = vi.hoisted(() => ({
  requireDeveloperAdminMock: vi.fn(),
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/auth/developer-admin', () => ({
  requireDeveloperAdmin: requireDeveloperAdminMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('dev subscriptions route', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    requireDeveloperAdminMock.mockResolvedValue({
      ok: true,
      user: { id: 'dev-user-1' },
    })

    createClientMock.mockReturnValue({
      from(table: string) {
        if (table === 'stores') {
          return {
            select() {
              return {
                eq() {
                  return this
                },
                maybeSingle: async () => ({ data: { id: 'store-1' }, error: null }),
              }
            },
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    })
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
  })

  // TRACE-154
  it('POST /api/dev/subscriptions/[store_id] redirects with validation message for invalid billing status', async () => {
    const { POST } = await import('../src/app/api/dev/subscriptions/[store_id]/route')
    const form = new FormData()
    form.set('plan_code', 'standard')
    form.set('billing_status', 'invalid')
    form.set('billing_cycle', 'monthly')
    form.set('amount_jpy', '0')

    const response = await POST(
      new Request('http://localhost/api/dev/subscriptions/store-1', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ store_id: 'store-1' }) }
    )

    expect(response.status).toBe(303)
    const location = response.headers.get('location') ?? ''
    expect(location).toContain('/dev/subscriptions')
    expect(decodeURIComponent(location)).toContain('課金ステータスが不正です。')
  })
})
