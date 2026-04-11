import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentServiceError } from '../src/lib/payments/services/shared'

const {
  createStoreScopedClientMock,
  createPaymentMock,
  normalizeCreatePaymentInputMock,
  insertAuditLogBestEffortMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createPaymentMock: vi.fn(),
  normalizeCreatePaymentInputMock: vi.fn(() => ({ idempotencyKey: null })),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/payments/services/create', () => ({
  createPayment: createPaymentMock,
  normalizeCreatePaymentInput: normalizeCreatePaymentInputMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createPaymentsRouteSupabaseMock(options?: {
  listRows?: Array<Record<string, unknown>>
  listErrorMessage?: string | null
}) {
  const listRows = options?.listRows ?? [{ id: 'payment-1', total_amount: 5500 }]
  const listErrorMessage = options?.listErrorMessage ?? null

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'payments') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select(selectArg?: string) {
          if (selectArg?.includes('customers(')) {
            return {
              eq() {
                return this
              },
              order: async () => ({
                data: listErrorMessage ? null : listRows,
                error: listErrorMessage ? { message: listErrorMessage } : null,
              }),
            }
          }

          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }
        },
      }
    },
  }
}

describe('payments route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPaymentsRouteSupabaseMock(),
      storeId: 'store-1',
    })
    createPaymentMock.mockResolvedValue({
      id: 'payment-new-1',
      appointment_id: 'appt-1',
    })
  })

  // TRACE-112
  it('GET returns payment list', async () => {
    const { GET } = await import('../src/app/api/payments/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'payment-1', total_amount: 5500 }])
  })

  // TRACE-113
  it('POST uses x-idempotency-key when form input has no idempotencyKey', async () => {
    const { POST } = await import('../src/app/api/payments/route')
    const formData = new FormData()
    const response = await POST(
      new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-123' },
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/receipts/payment-new-1')
    expect(createPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'idem-123' }),
      })
    )
  })

  // TRACE-114
  it('POST ignores unsafe redirect_to and falls back to receipt URL', async () => {
    const { POST } = await import('../src/app/api/payments/route')
    const formData = new FormData()
    formData.set('redirect_to', 'https://evil.example.com/phishing')

    const response = await POST(
      new Request('http://localhost/api/payments', {
        method: 'POST',
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/receipts/payment-new-1')
  })

  // TRACE-115
  it('POST returns PaymentServiceError status/message', async () => {
    createPaymentMock.mockRejectedValue(new PaymentServiceError('会計金額が不正です。', 400))
    const { POST } = await import('../src/app/api/payments/route')
    const response = await POST(
      new Request('http://localhost/api/payments', {
        method: 'POST',
        body: new FormData(),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '会計金額が不正です。' })
  })
})
