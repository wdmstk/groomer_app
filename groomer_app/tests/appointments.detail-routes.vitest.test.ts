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

function createAppointmentDetailSupabaseMock(params?: {
  status?: string
  reservationPaymentMethod?: string
  reservationPaymentStatus?: string
  reservationPaymentPaidAt?: string | null
  reservationPaymentAuthorizedAt?: string | null
}) {
  const appointmentRow = {
    id: 'appt-1',
    status: params?.status ?? '予約済',
    customer_id: 'customer-1',
    checked_in_at: null,
    in_service_at: null,
    payment_waiting_at: null,
    completed_at: null,
    reservation_payment_method: params?.reservationPaymentMethod ?? 'none',
    reservation_payment_status: params?.reservationPaymentStatus ?? 'unpaid',
    reservation_payment_paid_at: params?.reservationPaymentPaidAt ?? null,
    reservation_payment_authorized_at: params?.reservationPaymentAuthorizedAt ?? null,
  }
  const updateCalls: Array<Record<string, unknown>> = []

  return {
    updateCalls,
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
              data: appointmentRow,
              error: null,
            }),
          }
        },
        update(payload: Record<string, unknown>) {
          updateCalls.push(payload)
          return {
            eq() {
              return this
            },
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
    const mock = createAppointmentDetailSupabaseMock({ status: '予約済' })
    createStoreScopedClientMock.mockResolvedValue({
      supabase: mock,
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
    const mock = createAppointmentDetailSupabaseMock({ status: '予約済' })
    createStoreScopedClientMock.mockResolvedValue({
      supabase: mock,
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

  // TRACE-352
  it('POST /api/appointments/[appointment_id]/move returns 400 for invalid start_time/staff_id', async () => {
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/move/route')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start_time: 'bad-date', staff_id: '' }),
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '開始日時またはスタッフが不正です。',
    })
  })

  // TRACE-355
  it('POST /api/appointments/[appointment_id]/status/revert redirects when status is already 会計待ち', async () => {
    const mock = createAppointmentDetailSupabaseMock({ status: '会計待ち' })
    createStoreScopedClientMock.mockResolvedValue({
      supabase: mock,
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/status/revert/route')
    const form = new FormData()
    form.set('redirect_to', '/appointments/appt-1')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/status/revert', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/appointments/appt-1')
  })

  it('POST /api/appointments/[appointment_id]/confirm updates card_hold authorized to captured', async () => {
    const mock = createAppointmentDetailSupabaseMock({
      status: '予約申請',
      reservationPaymentMethod: 'card_hold',
      reservationPaymentStatus: 'authorized',
      reservationPaymentAuthorizedAt: '2026-04-12T00:00:00.000Z',
    })
    createStoreScopedClientMock.mockResolvedValue({
      supabase: mock,
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/confirm/route')
    const form = new FormData()
    form.set('redirect_to', '/appointments?tab=list')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1/confirm', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ appointment_id: 'appt-1' }) }
    )

    expect(response.status).toBe(303)
    expect(mock.updateCalls[0]).toMatchObject({
      status: '予約済',
      reservation_payment_status: 'captured',
      reservation_payment_authorized_at: '2026-04-12T00:00:00.000Z',
    })
  })

  it('POST /api/appointments/[appointment_id]/confirm marks charge_pending when card_hold is not authorized', async () => {
    const mock = createAppointmentDetailSupabaseMock({
      status: '予約申請',
      reservationPaymentMethod: 'card_hold',
      reservationPaymentStatus: 'unpaid',
    })
    createStoreScopedClientMock.mockResolvedValue({
      supabase: mock,
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

    expect(response.status).toBe(303)
    expect(mock.updateCalls[0]).toMatchObject({
      status: '予約済',
      reservation_payment_status: 'charge_pending',
    })
  })
})
