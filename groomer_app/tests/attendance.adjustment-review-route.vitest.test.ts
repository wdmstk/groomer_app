import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock, recomputeAttendanceDailySummaryMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
  recomputeAttendanceDailySummaryMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
}))

vi.mock('@/lib/staff-shifts/attendance', () => ({
  recomputeAttendanceDailySummary: recomputeAttendanceDailySummaryMock,
}))

function createReviewSupabaseMock(options?: {
  requestRow?: Record<string, unknown> | null
  requestErrorMessage?: string | null
  insertErrorMessage?: string | null
  updateErrorMessage?: string | null
}) {
  const requestRow = options?.requestRow ?? {
    id: 'req-1',
    store_id: 'store-1',
    staff_id: 'staff-1',
    business_date: '2026-04-13',
    status: 'pending',
    requested_payload: {
      events: [
        {
          event_type: 'clock_in',
          occurred_at: '2026-04-13T09:00:00.000Z',
        },
      ],
    },
  }
  const requestErrorMessage = options?.requestErrorMessage ?? null
  const insertErrorMessage = options?.insertErrorMessage ?? null
  const updateErrorMessage = options?.updateErrorMessage ?? null

  return {
    from(table: string) {
      if (table === 'attendance_adjustment_requests') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: requestErrorMessage ? null : requestRow,
                error: requestErrorMessage ? { message: requestErrorMessage } : null,
              }),
            }
          },
          update() {
            return {
              eq() {
                return this
              },
              then(resolve: (value: unknown) => unknown) {
                return Promise.resolve(
                  resolve({
                    error: updateErrorMessage ? { message: updateErrorMessage } : null,
                  })
                )
              },
            }
          },
        }
      }

      if (table === 'attendance_events') {
        return {
          insert: async () => ({
            error: insertErrorMessage ? { message: insertErrorMessage } : null,
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('attendance adjustment review route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    recomputeAttendanceDailySummaryMock.mockResolvedValue({
      worked_minutes: 120,
      break_minutes: 0,
      status: 'complete',
    })
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'owner',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createReviewSupabaseMock(),
    })
  })

  // TRACE-450-ATT-009
  it('returns 400 when decision is invalid', async () => {
    const { POST } = await import('../src/app/api/attendance/adjustment-requests/[request_id]/review/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests/req-1/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'invalid' }),
      }),
      { params: Promise.resolve({ request_id: 'req-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'decision は approve/reject を指定してください。',
    })
  })

  // TRACE-450-ATT-010
  it('returns 409 when request is already processed', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'owner',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createReviewSupabaseMock({
        requestRow: {
          id: 'req-1',
          store_id: 'store-1',
          staff_id: 'staff-1',
          business_date: '2026-04-13',
          status: 'approved',
          requested_payload: {},
        },
      }),
    })
    const { POST } = await import('../src/app/api/attendance/adjustment-requests/[request_id]/review/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests/req-1/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'approve' }),
      }),
      { params: Promise.resolve({ request_id: 'req-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ message: 'この申請はすでに処理済みです。' })
  })

  // TRACE-450-ATT-011
  it('approves request and returns summary', async () => {
    const { POST } = await import('../src/app/api/attendance/adjustment-requests/[request_id]/review/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests/req-1/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'approve' }),
      }),
      { params: Promise.resolve({ request_id: 'req-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { decision: 'approved' },
    })
    expect(recomputeAttendanceDailySummaryMock).toHaveBeenCalledTimes(1)
    expect(recomputeAttendanceDailySummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        staffId: 'staff-1',
        businessDate: '2026-04-13',
      })
    )
  })

  // TRACE-450-ATT-012
  it('rejects request via form-data and redirects', async () => {
    const formData = new FormData()
    formData.set('decision', 'reject')
    formData.set('redirect_to', '/staffs?tab=attendance')

    const { POST } = await import('../src/app/api/attendance/adjustment-requests/[request_id]/review/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests/req-1/review', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ request_id: 'req-1' }) }
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=attendance')
  })
})
