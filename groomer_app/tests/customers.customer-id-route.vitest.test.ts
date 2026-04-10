import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  insertAuditLogBestEffortMock,
  deleteCustomerWithDependenciesMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
  deleteCustomerWithDependenciesMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

vi.mock('@/lib/customers/services/delete', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/customers/services/delete')>(
    '../src/lib/customers/services/delete'
  )
  return {
    ...actual,
    deleteCustomerWithDependencies: deleteCustomerWithDependenciesMock,
  }
})

function createCustomerIdRouteSupabaseMock() {
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
            maybeSingle: async () => ({
              data: {
                id: 'customer-1',
                full_name: '顧客A',
                phone_number: '090-1111-1111',
                email: null,
                address: null,
                line_id: null,
                how_to_know: null,
                tags: ['既存'],
              },
              error: null,
            }),
            single: async () => ({
              data: {
                id: 'customer-1',
                full_name: '顧客A',
              },
              error: null,
            }),
          }
        },
        update(payload: Record<string, unknown>) {
          return {
            eq() {
              return this
            },
            select() {
              return {
                single: async () => ({
                  data: {
                    id: 'customer-1',
                    full_name: payload.full_name,
                    tags: payload.tags,
                  },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  }
}

function buildParams(customerId = 'customer-1') {
  return { params: Promise.resolve({ customer_id: customerId }) }
}

describe('customers/[customer_id] route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createCustomerIdRouteSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-095
  it('PUT returns 400 when full_name is missing', async () => {
    const { PUT } = await import('../src/app/api/customers/[customer_id]/route')
    const response = await PUT(
      new Request('http://localhost/api/customers/customer-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ full_name: '' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ message: '氏名は必須です。' })
  })

  // TRACE-096
  it('POST returns 405 for unsupported _method', async () => {
    const { POST } = await import('../src/app/api/customers/[customer_id]/route')
    const formData = new FormData()
    formData.set('_method', 'unknown')

    const response = await POST(
      new Request('http://localhost/api/customers/customer-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toMatchObject({ message: 'Unsupported method' })
  })

  // TRACE-097
  it('POST with _method=put redirects to customers/manage and normalizes tags', async () => {
    const { POST } = await import('../src/app/api/customers/[customer_id]/route')
    const formData = new FormData()
    formData.set('_method', 'put')
    formData.set('full_name', '更新後顧客')
    formData.set('tags', ' VIP, ,再来店 ')

    const response = await POST(
      new Request('http://localhost/api/customers/customer-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/customers/manage?customer_id=customer-1')
    expect(insertAuditLogBestEffortMock).toHaveBeenCalledTimes(1)
    expect(insertAuditLogBestEffortMock.mock.calls[0]?.[0]).toMatchObject({
      entityType: 'customer',
      action: 'updated',
      after: expect.objectContaining({ tags: ['VIP', '再来店'] }),
    })
  })

  // TRACE-098
  it('DELETE succeeds and records deleted audit log', async () => {
    const { DELETE } = await import('../src/app/api/customers/[customer_id]/route')

    const response = await DELETE(
      new Request('http://localhost/api/customers/customer-1', { method: 'DELETE' }),
      buildParams()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(deleteCustomerWithDependenciesMock).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1', customerId: 'customer-1' })
    )
    expect(insertAuditLogBestEffortMock).toHaveBeenCalledTimes(1)
    expect(insertAuditLogBestEffortMock.mock.calls[0]?.[0]).toMatchObject({
      entityType: 'customer',
      action: 'deleted',
      entityId: 'customer-1',
    })
  })
})
