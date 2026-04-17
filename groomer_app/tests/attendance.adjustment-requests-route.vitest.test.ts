import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
}))

function createAdjustmentRequestsSupabaseMock(options?: {
  ownStaffId?: string | null
  listRows?: Array<Record<string, unknown>>
  listErrorMessage?: string | null
  insertErrorMessage?: string | null
}) {
  const ownStaffId = options?.ownStaffId ?? 'staff-self'
  const listRows = options?.listRows ?? [{ id: 'req-1', status: 'pending' }]
  const listErrorMessage = options?.listErrorMessage ?? null
  const insertErrorMessage = options?.insertErrorMessage ?? null

  return {
    from(table: string) {
      if (table === 'staffs') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: ownStaffId ? { id: ownStaffId } : null,
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'attendance_adjustment_requests') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
              then(resolve: (value: unknown) => unknown) {
                return Promise.resolve(
                  resolve({
                    data: listErrorMessage ? null : listRows,
                    error: listErrorMessage ? { message: listErrorMessage } : null,
                  })
                )
              },
            }
          },
          insert: async () => ({
            error: insertErrorMessage ? { message: insertErrorMessage } : null,
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('attendance adjustment requests route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'staff',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createAdjustmentRequestsSupabaseMock(),
    })
  })

  // TRACE-450-ATT-005
  it('GET returns requests for store', async () => {
    const { GET } = await import('../src/app/api/attendance/adjustment-requests/route')
    const response = await GET(new Request('http://localhost/api/attendance/adjustment-requests'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { requests: [{ id: 'req-1', status: 'pending' }] },
    })
  })

  // TRACE-450-ATT-006
  it('POST returns 400 when reason is missing', async () => {
    const { POST } = await import('../src/app/api/attendance/adjustment-requests/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          staff_id: 'staff-self',
          reason: '   ',
          requested_payload: {},
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'reason は必須です。' })
  })

  // TRACE-450-ATT-007
  it('POST returns 403 when staff submits request for another staff', async () => {
    const { POST } = await import('../src/app/api/attendance/adjustment-requests/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          staff_id: 'staff-other',
          reason: '修正依頼',
          requested_payload: { events: [] },
        }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: '他スタッフの修正申請はできません。' })
  })

  // TRACE-450-ATT-008
  it('POST accepts form-data and redirects', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'owner',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createAdjustmentRequestsSupabaseMock({ ownStaffId: 'staff-self' }),
    })

    const formData = new FormData()
    formData.set('staff_id', 'staff-target')
    formData.set('business_date', '2026-04-13')
    formData.set('requested_event_type', 'clock_in')
    formData.set('requested_occurred_at', '2026-04-13T09:00')
    formData.set('reason', '手動修正')
    formData.set('redirect_to', '/staffs?tab=attendance')

    const { POST } = await import('../src/app/api/attendance/adjustment-requests/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/adjustment-requests', {
        method: 'POST',
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=attendance')
  })
})
