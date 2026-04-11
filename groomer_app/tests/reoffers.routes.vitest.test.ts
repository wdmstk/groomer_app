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

vi.mock('@/lib/line', () => ({
  sendLineMessage: vi.fn(async () => ({ success: true as const })),
}))

function createReoffersSupabaseMock(options?: { reofferStatus?: string | null }) {
  const reofferStatus = options?.reofferStatus ?? null

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'slot_reoffers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data:
                  reofferStatus === null
                    ? null
                    : {
                        id: 'reoffer-1',
                        appointment_id: 'appt-1',
                        target_customer_id: 'customer-1',
                        target_pet_id: 'pet-1',
                        target_staff_id: 'staff-1',
                        status: reofferStatus,
                        notes: null,
                      },
                error: null,
              }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('reoffers routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createReoffersSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-253
  it('PATCH /api/reoffers/[reoffer_id]/status returns 400 for invalid status', async () => {
    const { PATCH } = await import('../src/app/api/reoffers/[reoffer_id]/status/route')
    const response = await PATCH(
      new Request('http://localhost/api/reoffers/reoffer-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'opened' }),
      }),
      { params: Promise.resolve({ reoffer_id: 'reoffer-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'status が不正です。' })
  })

  // TRACE-254
  it('POST /api/reoffers/[reoffer_id]/approve-send returns 404 when reoffer is not found', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createReoffersSupabaseMock({ reofferStatus: null }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/reoffers/[reoffer_id]/approve-send/route')
    const response = await POST(
      new Request('http://localhost/api/reoffers/reoffer-1/approve-send', { method: 'POST' }),
      { params: Promise.resolve({ reoffer_id: 'reoffer-1' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '再販レコードが見つかりません。' })
  })

  // TRACE-255
  it('POST /api/reoffers/[reoffer_id]/approve-send returns 400 for non-draft status', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createReoffersSupabaseMock({ reofferStatus: 'sent' }),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/reoffers/[reoffer_id]/approve-send/route')
    const response = await POST(
      new Request('http://localhost/api/reoffers/reoffer-1/approve-send', { method: 'POST' }),
      { params: Promise.resolve({ reoffer_id: 'reoffer-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'draft のみ承認送信できます。' })
  })

  // TRACE-256
  it('POST /api/reoffers/waitlists redirects when customer_id is missing', async () => {
    const { POST } = await import('../src/app/api/reoffers/waitlists/route')
    const form = new FormData()
    form.set('redirect_to', '/customers/manage?view=alerts')
    const response = await POST(
      new Request('http://localhost/api/reoffers/waitlists', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/customers/manage?view=alerts')
  })
})
