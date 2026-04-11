import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

function createPosSupabaseMock(options?: {
  openSession?: Record<string, unknown> | null
}) {
  const openSession = options?.openSession ?? null

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'pos_sessions') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
              limit() {
                return this
              },
              maybeSingle: async () => ({ data: openSession, error: null }),
              single: async () => ({ data: { id: 'session-1', status: 'open', opened_at: '2026-04-01' }, error: null }),
            }
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: 'session-1', status: 'open', opened_at: '2026-04-01', notes: null },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      if (table === 'pos_orders') {
        return {
          select() {
            return {
              eq() {
                return this
              },
            }
          },
        }
      }

      if (table === 'pos_payments') {
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

      if (table === 'cash_drawer_events') {
        return {
          select() {
            return {
              eq() {
                return this
              },
            }
          },
        }
      }

      if (table === 'pos_order_lines') {
        return {
          insert: async () => ({ error: null }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('pos routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPosSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-127
  it('POST /api/pos/sessions/open returns 409 when open session already exists', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPosSupabaseMock({
        openSession: { id: 'session-open-1', status: 'open', opened_at: '2026-04-01T00:00:00.000Z' },
      }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/pos/sessions/open/route')
    const response = await POST(
      new Request('http://localhost/api/pos/sessions/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'open session' }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: 'POS_SESSION_ALREADY_OPEN',
    })
  })

  // TRACE-128
  it('POST /api/pos/sessions/[session_id]/close returns 400 for invalid JSON', async () => {
    const { POST } = await import('../src/app/api/pos/sessions/[session_id]/close/route')
    const response = await POST(
      new Request('http://localhost/api/pos/sessions/session-1/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: Promise.resolve({ session_id: 'session-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'POS_INVALID_JSON',
      message: 'invalid json body.',
    })
  })

  // TRACE-129
  it('POST /api/pos/orders returns 400 when lines are missing', async () => {
    const { POST } = await import('../src/app/api/pos/orders/route')
    const response = await POST(
      new Request('http://localhost/api/pos/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines: [] }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'POS_LINES_REQUIRED',
      message: 'lines are required.',
    })
  })

  // TRACE-130
  it('POST /api/pos/orders/[order_id]/confirm returns 400 when payment method is missing', async () => {
    const { POST } = await import('../src/app/api/pos/orders/[order_id]/confirm/route')
    const response = await POST(
      new Request('http://localhost/api/pos/orders/order-1/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotency_key: 'idem-1' }),
      }),
      { params: Promise.resolve({ order_id: 'order-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'POS_PAYMENT_METHOD_REQUIRED',
      message: 'payment method is required.',
    })
  })

  // TRACE-131
  it('POST /api/pos/orders/[order_id]/void returns 400 when reason is missing', async () => {
    const { POST } = await import('../src/app/api/pos/orders/[order_id]/void/route')
    const response = await POST(
      new Request('http://localhost/api/pos/orders/order-1/void', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotency_key: 'idem-void-1' }),
      }),
      { params: Promise.resolve({ order_id: 'order-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'POS_VOID_REASON_REQUIRED',
      message: 'reason is required.',
    })
  })

  // TRACE-132
  it('POST /api/pos/cash-drawer-events returns 400 when amount is invalid', async () => {
    const { POST } = await import('../src/app/api/pos/cash-drawer-events/route')
    const response = await POST(
      new Request('http://localhost/api/pos/cash-drawer-events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: 'session-1',
          event_type: 'cash_in',
          amount: -1,
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'POS_AMOUNT_INVALID',
      message: 'amount must be >= 0.',
    })
  })
})
