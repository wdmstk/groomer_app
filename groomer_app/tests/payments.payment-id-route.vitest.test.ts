import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentServiceError } from '../src/lib/payments/services/shared'

const {
  createStoreScopedClientMock,
  normalizeUpdatePaymentJsonInputMock,
  normalizeUpdatePaymentFormInputMock,
  updatePaymentMock,
  deletePaymentMock,
  insertAuditLogBestEffortMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  normalizeUpdatePaymentJsonInputMock: vi.fn((value) => value),
  normalizeUpdatePaymentFormInputMock: vi.fn(() => ({})),
  updatePaymentMock: vi.fn(),
  deletePaymentMock: vi.fn(),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/payments/services/update', () => ({
  normalizeUpdatePaymentJsonInput: normalizeUpdatePaymentJsonInputMock,
  normalizeUpdatePaymentFormInput: normalizeUpdatePaymentFormInputMock,
  updatePayment: updatePaymentMock,
}))

vi.mock('@/lib/payments/services/delete', () => ({
  deletePayment: deletePaymentMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createPaymentIdRouteSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'payments') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({
              data: { id: 'payment-1', total_amount: 5500, status: 'paid' },
              error: null,
            }),
            single: async () => ({
              data: { id: 'payment-1', total_amount: 5500, status: 'paid' },
              error: null,
            }),
          }
        },
      }
    },
  }
}

function buildParams(paymentId = 'payment-1') {
  return { params: Promise.resolve({ payment_id: paymentId }) }
}

describe('payments/[payment_id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPaymentIdRouteSupabaseMock(),
      storeId: 'store-1',
    })
    updatePaymentMock.mockResolvedValue({ id: 'payment-1', total_amount: 7000 })
    deletePaymentMock.mockResolvedValue({ success: true })
  })

  // TRACE-116
  it('GET returns payment detail', async () => {
    const { GET } = await import('../src/app/api/payments/[payment_id]/route')
    const response = await GET(
      new Request('http://localhost/api/payments/payment-1', { method: 'GET' }),
      buildParams()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 'payment-1', total_amount: 5500, status: 'paid' })
  })

  // TRACE-117
  it('POST with _method=delete deletes payment and redirects to /payments', async () => {
    const { POST } = await import('../src/app/api/payments/[payment_id]/route')
    const formData = new FormData()
    formData.set('_method', 'delete')
    const response = await POST(
      new Request('http://localhost/api/payments/payment-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/payments')
    expect(deletePaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        paymentId: 'payment-1',
      })
    )
  })

  // TRACE-118
  it('POST returns 405 for unsupported _method', async () => {
    const { POST } = await import('../src/app/api/payments/[payment_id]/route')
    const formData = new FormData()
    formData.set('_method', 'unknown')
    const response = await POST(
      new Request('http://localhost/api/payments/payment-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-119
  it('PUT returns PaymentServiceError status/message', async () => {
    updatePaymentMock.mockRejectedValue(new PaymentServiceError('会計ステータスが不正です。', 400))
    const { PUT } = await import('../src/app/api/payments/[payment_id]/route')
    const response = await PUT(
      new Request('http://localhost/api/payments/payment-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'invalid' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '会計ステータスが不正です。' })
  })
})
