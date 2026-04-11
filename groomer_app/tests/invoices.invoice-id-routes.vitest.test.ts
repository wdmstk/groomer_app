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

function createInvoiceIdSupabaseMock(options?: {
  invoice?: Record<string, unknown> | null
  existingPayment?: Record<string, unknown> | null
}) {
  const invoice =
    options && 'invoice' in options
      ? (options.invoice ?? null)
      :
    ({
      id: 'invoice-1',
      customer_id: 'customer-1',
      status: 'open',
      subtotal_amount: 5000,
      tax_amount: 500,
      discount_amount: 0,
      total_amount: 5500,
      notes: null,
    } satisfies Record<string, unknown>)
  const existingPayment = options && 'existingPayment' in options ? (options.existingPayment ?? null) : null

  return {
    from(table: string) {
      if (table === 'invoices') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: invoice, error: null }),
              single: async () => ({ data: invoice, error: null }),
            }
          },
          update() {
            return {
              eq() {
                return this
              },
              select() {
                return {
                  single: async () => ({ data: invoice, error: null }),
                }
              },
            }
          },
        }
      }

      if (table === 'invoice_lines') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
            }
          },
        }
      }

      if (table === 'payments') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: existingPayment, error: null }),
              single: async () => ({ data: { id: 'payment-1' }, error: null }),
            }
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({ data: { id: 'payment-1' }, error: null }),
                }
              },
            }
          },
        }
      }

      if (table === 'hotel_stays') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              in() {
                return this
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
              maybeSingle: async () => ({ data: null, error: null }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function buildParams(invoiceId = 'invoice-1') {
  return { params: Promise.resolve({ invoice_id: invoiceId }) }
}

describe('invoices/[invoice_id] routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoiceIdSupabaseMock(),
      storeId: 'store-1',
      userId: 'user-1',
    })
  })

  // TRACE-123
  it('GET returns 404 when invoice is not found', async () => {
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoiceIdSupabaseMock({ invoice: null }),
      storeId: 'store-1',
      userId: 'user-1',
    })
    const { GET } = await import('../src/app/api/invoices/[invoice_id]/route')
    const response = await GET(
      new Request('http://localhost/api/invoices/invoice-1', { method: 'GET' }),
      buildParams()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Invoice not found.' })
  })

  // TRACE-124
  it('PATCH returns 409 when invoice is not editable', async () => {
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoiceIdSupabaseMock({
        invoice: {
          id: 'invoice-1',
          status: 'paid',
          subtotal_amount: 5000,
          tax_amount: 500,
          discount_amount: 0,
          total_amount: 5500,
          notes: null,
        },
      }),
      storeId: 'store-1',
      userId: 'user-1',
    })
    const { PATCH } = await import('../src/app/api/invoices/[invoice_id]/route')
    const response = await PATCH(
      new Request('http://localhost/api/invoices/invoice-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'updated' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: 'INVOICE_NOT_EDITABLE: paid/void invoice cannot be edited.',
    })
  })

  // TRACE-125
  it('POST /pay returns reused payment when payment already exists for invoice', async () => {
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoiceIdSupabaseMock({
        existingPayment: { id: 'payment-existing-1', invoice_id: 'invoice-1', paid_at: '2026-04-01T00:00:00.000Z' },
      }),
      storeId: 'store-1',
      userId: 'user-1',
    })
    const { POST } = await import('../src/app/api/invoices/[invoice_id]/pay/route')
    const response = await POST(
      new Request('http://localhost/api/invoices/invoice-1/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: '現金' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      payment_id: 'payment-existing-1',
      reused: true,
    })
  })

  // TRACE-126
  it('POST /pay returns 409 when invoice status is void', async () => {
    requireInvoiceStoreGuardMock.mockResolvedValue({
      supabase: createInvoiceIdSupabaseMock({
        invoice: {
          id: 'invoice-1',
          customer_id: 'customer-1',
          status: 'void',
          subtotal_amount: 5000,
          tax_amount: 500,
          discount_amount: 0,
          total_amount: 5500,
          notes: null,
        },
      }),
      storeId: 'store-1',
      userId: 'user-1',
    })
    const { POST } = await import('../src/app/api/invoices/[invoice_id]/pay/route')
    const response = await POST(
      new Request('http://localhost/api/invoices/invoice-1/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: '現金' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: 'INVOICE_NOT_EDITABLE: void invoice cannot be paid.',
    })
  })
})
