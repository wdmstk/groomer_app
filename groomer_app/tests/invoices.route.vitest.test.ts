import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireInvoiceStoreGuardMock } = vi.hoisted(() => ({
  requireInvoiceStoreGuardMock: vi.fn(),
}))

vi.mock('@/lib/invoices/shared', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/invoices/shared')>(
    '../src/lib/invoices/shared'
  )
  return {
    ...actual,
    requireInvoiceStoreGuard: requireInvoiceStoreGuardMock,
  }
})

function createInvoicesRouteSupabaseMock(options?: {
  listRows?: Array<Record<string, unknown>>
  listErrorMessage?: string | null
}) {
  const listRows = options?.listRows ?? [{ id: 'invoice-1', status: 'open', total_amount: 5500 }]
  const listErrorMessage = options?.listErrorMessage ?? null

  return {
    from(table: string) {
      if (table !== 'invoices') {
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
            limit: async () => ({
              data: listErrorMessage ? null : listRows,
              error: listErrorMessage ? { message: listErrorMessage } : null,
            }),
            single: async () => ({
              data: { id: 'invoice-new-1' },
              error: null,
            }),
          }
        },
      }
    },
  }
}

describe('invoices route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoicesRouteSupabaseMock(),
      storeId: 'store-1',
      userId: 'user-1',
    })
  })

  // TRACE-120
  it('GET returns invoice list', async () => {
    const { GET } = await import('../src/app/api/invoices/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      invoices: [{ id: 'invoice-1', status: 'open', total_amount: 5500 }],
    })
  })

  // TRACE-121
  it('POST returns 400 when body is invalid JSON', async () => {
    const { POST } = await import('../src/app/api/invoices/route')
    const response = await POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid JSON body.' })
  })

  // TRACE-122
  it('POST returns 400 when appointment_ids and hotel_stay_ids are both missing', async () => {
    const { POST } = await import('../src/app/api/invoices/route')
    const response = await POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_id: 'customer-1',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'appointment_ids or hotel_stay_ids is required.',
    })
  })
})
