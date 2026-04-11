import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createAdminSupabaseClientMock,
  fetchPublicReservationBootstrapMock,
  createPublicReservationMock,
  normalizePublicReservationInputMock,
  normalizeQrLookupInputMock,
  lookupPublicReservationQrMock,
  cancelPublicReservationMock,
  PublicReservationServiceErrorMock,
} = vi.hoisted(() => {
  class MockPublicReservationServiceError extends Error {
    status: number

    constructor(message: string, status = 500) {
      super(message)
      this.status = status
    }
  }

  return {
    createAdminSupabaseClientMock: vi.fn(),
    fetchPublicReservationBootstrapMock: vi.fn(),
    createPublicReservationMock: vi.fn(),
    normalizePublicReservationInputMock: vi.fn(),
    normalizeQrLookupInputMock: vi.fn(),
    lookupPublicReservationQrMock: vi.fn(),
    cancelPublicReservationMock: vi.fn(),
    PublicReservationServiceErrorMock: MockPublicReservationServiceError,
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/public-reservations/services/create', () => ({
  fetchPublicReservationBootstrap: fetchPublicReservationBootstrapMock,
  createPublicReservation: createPublicReservationMock,
}))

vi.mock('@/lib/public-reservations/services/shared', () => ({
  normalizePublicReservationInput: normalizePublicReservationInputMock,
  normalizeQrLookupInput: normalizeQrLookupInputMock,
  PublicReservationServiceError: PublicReservationServiceErrorMock,
}))

vi.mock('@/lib/public-reservations/services/qr-lookup', () => ({
  lookupPublicReservationQr: lookupPublicReservationQrMock,
}))

vi.mock('@/lib/public-reservations/services/cancel', () => ({
  cancelPublicReservation: cancelPublicReservationMock,
}))

describe('public reserve routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createAdminSupabaseClientMock.mockReturnValue({
      from: () => ({
        insert: vi.fn(async () => ({ error: null })),
      }),
    })
  })

  // TRACE-236
  it('GET /api/public/reserve/[store_id] maps PublicReservationServiceError status', async () => {
    fetchPublicReservationBootstrapMock.mockRejectedValueOnce(
      new PublicReservationServiceErrorMock('店舗が見つかりません。', 404)
    )

    const { GET } = await import('../src/app/api/public/reserve/[store_id]/route')
    const response = await GET(new Request('http://localhost/api/public/reserve/store-404'), {
      params: Promise.resolve({ store_id: 'store-404' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '店舗が見つかりません。' })
  })

  // TRACE-237
  it('POST /api/public/reserve/[store_id] writes audit logs and returns created reservation payload', async () => {
    const insertMock = vi.fn(async () => ({ error: null }))
    createAdminSupabaseClientMock.mockReturnValueOnce({
      from: () => ({ insert: insertMock }),
    })
    normalizePublicReservationInputMock.mockReturnValueOnce({
      menuIds: ['menu-1'],
      preferredStart: '2026-04-20T10:00:00.000Z',
      memberPortalToken: 'member-token',
    })
    createPublicReservationMock.mockResolvedValueOnce({
      appointmentId: 'appt-1',
      groupId: 'group-1',
      status: '予約済',
      assignedStaffId: 'staff-1',
    })

    const { POST } = await import('../src/app/api/public/reserve/[store_id]/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/store-1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ any: 'payload' }),
      }),
      { params: Promise.resolve({ store_id: 'store-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      appointmentId: 'appt-1',
      groupId: 'group-1',
      status: '予約済',
      assignedStaffId: 'staff-1',
    })
    expect(insertMock).toHaveBeenCalledTimes(2)
  })

  // TRACE-238
  it('POST /api/public/reserve/[store_id]/qr-lookup maps PublicReservationServiceError status', async () => {
    normalizeQrLookupInputMock.mockReturnValueOnce({ qrPayloadText: 'bad-qr' })
    lookupPublicReservationQrMock.mockRejectedValueOnce(
      new PublicReservationServiceErrorMock('QRが不正です。', 400)
    )

    const { POST } = await import('../src/app/api/public/reserve/[store_id]/qr-lookup/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/store-1/qr-lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qrPayloadText: 'bad-qr' }),
      }),
      { params: Promise.resolve({ store_id: 'store-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'QRが不正です。' })
  })

  // TRACE-239
  it('POST /api/public/reserve/cancel forwards empty token and returns service payload', async () => {
    cancelPublicReservationMock.mockResolvedValueOnce({ ok: true, status: 'cancelled' })

    const { POST } = await import('../src/app/api/public/reserve/cancel/route')
    const response = await POST(
      new Request('http://localhost/api/public/reserve/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(cancelPublicReservationMock).toHaveBeenCalledWith({ token: '' })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'cancelled' })
  })
})
