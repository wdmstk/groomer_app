import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, insertAuditLogBestEffortMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createCustomersRouteSupabaseMock(options?: {
  rows?: Array<Record<string, unknown>>
  selectError?: string | null
  insertError?: string | null
}) {
  const rows = options?.rows ?? [{ id: 'customer-1', full_name: '顧客A' }]
  const selectError = options?.selectError ?? null
  const insertError = options?.insertError ?? null

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'customers') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return this
            },
            order: async () => ({ data: selectError ? null : rows, error: selectError ? { message: selectError } : null }),
          }
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                single: async () => ({
                  data: insertError
                    ? null
                    : {
                        id: 'customer-new-1',
                        full_name: payload.full_name,
                      },
                  error: insertError ? { message: insertError } : null,
                }),
              }
            },
          }
        },
      }
    },
  }
}

describe('customers route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createCustomersRouteSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-091
  it('GET returns customer list', async () => {
    const { GET } = await import('../src/app/api/customers/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'customer-1', full_name: '顧客A' }])
  })

  // TRACE-092
  it('POST returns 400 when full_name is missing', async () => {
    const { POST } = await import('../src/app/api/customers/route')
    const request = new Request('http://localhost/api/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone_number: '090-0000-0000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ message: '氏名は必須です。' })
  })

  // TRACE-093
  it('POST accepts JSON tags array, trims blanks, and stores normalized tags', async () => {
    const { POST } = await import('../src/app/api/customers/route')
    const request = new Request('http://localhost/api/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        full_name: '顧客B',
        tags: [' VIP ', ' ', '再来店'],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 'customer-new-1', full_name: '顧客B' })
    expect(insertAuditLogBestEffortMock).toHaveBeenCalledTimes(1)
    expect(insertAuditLogBestEffortMock.mock.calls[0]?.[0]).toMatchObject({
      entityType: 'customer',
      action: 'created',
      after: expect.objectContaining({ tags: ['VIP', '再来店'] }),
    })
  })

  // TRACE-094
  it('POST form ignores unsafe redirect_to and falls back to /customers/manage?view=customers', async () => {
    const { POST } = await import('../src/app/api/customers/route')
    const formData = new FormData()
    formData.set('full_name', '顧客C')
    formData.set('redirect_to', 'https://evil.example.com/phishing')

    const response = await POST(
      new Request('http://localhost/api/customers', {
        method: 'POST',
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/customers/manage?view=customers')
  })
})
