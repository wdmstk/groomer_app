import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
}))

function createAttendanceDailySupabaseMock(options?: {
  ownStaffId?: string | null
  rows?: Array<Record<string, unknown>>
  listErrorMessage?: string | null
}) {
  const ownStaffId =
    options && Object.prototype.hasOwnProperty.call(options, 'ownStaffId')
      ? (options.ownStaffId ?? null)
      : 'staff-self'
  const rows = options?.rows ?? [{ id: 'sum-1', business_date: '2026-04-13', worked_minutes: 420 }]
  const listErrorMessage = options?.listErrorMessage ?? null

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

      if (table === 'attendance_daily_summaries') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              gte() {
                return this
              },
              lte() {
                return this
              },
              order() {
                return this
              },
              then(resolve: (value: unknown) => unknown) {
                return Promise.resolve(
                  resolve({
                    data: listErrorMessage ? null : rows,
                    error: listErrorMessage ? { message: listErrorMessage } : null,
                  })
                )
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('attendance daily and me routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'staff',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createAttendanceDailySupabaseMock(),
    })
  })

  // TRACE-450-ATT-013
  it('GET /daily returns 403 when staff requests another staff_id', async () => {
    const { GET } = await import('../src/app/api/attendance/daily/route')
    const response = await GET(
      new Request('http://localhost/api/attendance/daily?staff_id=staff-other&date=2026-04-13')
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: '他スタッフの勤務実績は閲覧できません。',
    })
  })

  // TRACE-450-ATT-014
  it('GET /daily returns summaries for owner', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'owner',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createAttendanceDailySupabaseMock(),
    })
    const { GET } = await import('../src/app/api/attendance/daily/route')
    const response = await GET(
      new Request('http://localhost/api/attendance/daily?staff_id=staff-a&date=2026-04-13')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        summaries: [{ id: 'sum-1', business_date: '2026-04-13', worked_minutes: 420 }],
      },
    })
  })

  // TRACE-450-ATT-015
  it('GET /me returns empty list when own staff is not linked', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      role: 'staff',
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createAttendanceDailySupabaseMock({ ownStaffId: null }),
    })
    const { GET } = await import('../src/app/api/attendance/me/route')
    const response = await GET(new Request('http://localhost/api/attendance/me'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { summaries: [] },
    })
  })

  // TRACE-450-ATT-016
  it('GET /me returns summaries for own staff', async () => {
    const { GET } = await import('../src/app/api/attendance/me/route')
    const response = await GET(
      new Request('http://localhost/api/attendance/me?from=2026-04-13&to=2026-04-14')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        summaries: [{ id: 'sum-1', business_date: '2026-04-13', worked_minutes: 420 }],
      },
    })
  })
})
