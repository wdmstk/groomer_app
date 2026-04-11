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

function createAppointmentDetailSupabaseMock(status: string) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'appointments') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq() {
              return this
            },
            single: async () => ({
              data: {
                id: 'appt-1',
                status,
                customer_id: 'customer-1',
                checked_in_at: null,
                in_service_at: null,
                payment_waiting_at: null,
                completed_at: null,
              },
              error: null,
            }),
          }
        },
      }
    },
  }
}

describe('appointments detail routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-257
  it('POST /api/appointments/[appointment_id]/confirm returns 400 when status is not 予約申請', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAppointmentDetailSupabaseMock('予約済'),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/confirm/route')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/confirm', {
        method: 'POST',
        body: new FormData(),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '予約申請ステータスではありません。' })
  })

  // TRACE-258
  it('POST /api/appointments/[appointment_id]/status returns 400 for invalid transition', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAppointmentDetailSupabaseMock('予約済'),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/status/route')
    const form = new FormData()
    form.set('next_status', '完了')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/status', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '不正なステータス遷移です。' })
  })
})
