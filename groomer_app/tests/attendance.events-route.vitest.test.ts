import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireStoreMembershipMock,
  resolveAttendanceFeatureStateMock,
  isAttendanceMonthClosedMock,
  recomputeAttendanceDailySummaryMock,
  createAdminSupabaseClientMock,
} = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
  resolveAttendanceFeatureStateMock: vi.fn(),
  isAttendanceMonthClosedMock: vi.fn(),
  recomputeAttendanceDailySummaryMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
}))

vi.mock('@/lib/attendance/feature', () => ({
  resolveAttendanceFeatureState: resolveAttendanceFeatureStateMock,
}))

vi.mock('@/lib/attendance/monthly-closing', () => ({
  monthKeyFromDateKey: (dateKey: string) => dateKey.slice(0, 7),
  isAttendanceMonthClosed: isAttendanceMonthClosedMock,
}))

vi.mock('@/lib/staff-shifts/attendance', () => ({
  recomputeAttendanceDailySummary: recomputeAttendanceDailySummaryMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

function createSupabaseMock(options?: {
  role?: 'owner' | 'admin' | 'staff'
  ownStaffId?: string | null
  targetStaffExists?: boolean
  locationRequired?: boolean
  storeLocationLat?: number | null
  storeLocationLng?: number | null
  storeLocationRadiusMeters?: number | null
  duplicateOccurredAt?: string | null
}) {
  const role = options?.role ?? 'staff'
  const ownStaffId = options?.ownStaffId ?? 'staff-self'
  const targetStaffExists = options?.targetStaffExists ?? true
  const locationRequired = options?.locationRequired ?? false
  const storeLocationLat = options?.storeLocationLat ?? null
  const storeLocationLng = options?.storeLocationLng ?? null
  const storeLocationRadiusMeters = options?.storeLocationRadiusMeters ?? null
  const duplicateOccurredAt = options?.duplicateOccurredAt ?? null

  let staffsMaybeSingleCount = 0
  const insertedEvents: Array<Record<string, unknown>> = []
  const blockedLogs: Array<Record<string, unknown>> = []

  const supabase = {
    from(table: string) {
      if (table === 'store_shift_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: {
                  attendance_location_required: locationRequired,
                  attendance_location_lat: storeLocationLat,
                  attendance_location_lng: storeLocationLng,
                  attendance_location_radius_meters: storeLocationRadiusMeters,
                },
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'staffs') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => {
                staffsMaybeSingleCount += 1
                if (staffsMaybeSingleCount === 1) {
                  return { data: ownStaffId ? { id: ownStaffId } : null, error: null }
                }
                return { data: targetStaffExists ? { id: 'staff-target' } : null, error: null }
              },
            }
          },
        }
      }

      if (table === 'attendance_punch_block_logs') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            blockedLogs.push(payload)
            return { error: null }
          },
        }
      }

      if (table === 'attendance_events') {
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
              maybeSingle: async () => ({
                data: duplicateOccurredAt ? { occurred_at: duplicateOccurredAt } : null,
                error: null,
              }),
            }
          },
          insert: async (payload: Record<string, unknown>) => {
            insertedEvents.push(payload)
            return { error: null }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }

  requireStoreMembershipMock.mockResolvedValue({
    ok: true,
    role,
    storeId: 'store-1',
    user: { id: 'user-1' },
    supabase,
  })

  return { supabase, insertedEvents, blockedLogs }
}

describe('attendance events route (v1.3)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    resolveAttendanceFeatureStateMock.mockResolvedValue({ enabled: true, message: null })
    isAttendanceMonthClosedMock.mockResolvedValue({ closed: false, message: null })
    recomputeAttendanceDailySummaryMock.mockResolvedValue({
      clock_in_at: '2026-04-13T00:00:00.000Z',
      clock_out_at: null,
      break_minutes: 0,
      worked_minutes: 0,
      status: 'incomplete',
      flags: {},
    })
  })

  it('returns 422 when location is required but payload does not have location', async () => {
    const state = createSupabaseMock({
      role: 'owner',
      locationRequired: true,
      storeLocationLat: 35.681236,
      storeLocationLng: 139.767125,
      storeLocationRadiusMeters: 200,
    })

    const { POST } = await import('../src/app/api/attendance/events/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'clock_in',
          staff_id: 'staff-target',
          business_date: '2026-04-16',
          occurred_at: '2026-04-16T00:00:00.000Z',
        }),
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ message: 'この店舗では位置情報付き打刻が必須です。' })
    expect(state.insertedEvents).toHaveLength(0)
    expect(state.blockedLogs).toHaveLength(1)
    expect(state.blockedLogs[0]?.reason).toBe('location_required')
  })

  it('returns 422 when location is required but store base location is missing', async () => {
    const state = createSupabaseMock({
      role: 'owner',
      locationRequired: true,
      storeLocationLat: null,
      storeLocationLng: null,
      storeLocationRadiusMeters: 200,
    })

    const { POST } = await import('../src/app/api/attendance/events/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'clock_in',
          staff_id: 'staff-target',
          business_date: '2026-04-16',
          occurred_at: '2026-04-16T00:00:00.000Z',
          location_lat: '35.681236',
          location_lng: '139.767125',
          location_accuracy_meters: '15',
          location_captured_at: '2026-04-16T00:00:00.000Z',
        }),
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      message: '店舗の位置情報基準（緯度・経度・半径）が未設定です。',
    })
    expect(state.insertedEvents).toHaveLength(0)
    expect(state.blockedLogs[0]?.reason).toBe('location_store_settings_missing')
  })

  it('returns 403 when location is outside allowed radius', async () => {
    const state = createSupabaseMock({
      role: 'owner',
      locationRequired: true,
      storeLocationLat: 35.681236,
      storeLocationLng: 139.767125,
      storeLocationRadiusMeters: 100,
    })

    const { POST } = await import('../src/app/api/attendance/events/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'clock_in',
          staff_id: 'staff-target',
          business_date: '2026-04-16',
          occurred_at: '2026-04-16T00:00:00.000Z',
          location_lat: '35.700000',
          location_lng: '139.800000',
          location_accuracy_meters: '12',
          location_captured_at: '2026-04-16T00:00:00.000Z',
        }),
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: '店舗の許容半径外のため打刻できません。' })
    expect(state.insertedEvents).toHaveLength(0)
    expect(state.blockedLogs[0]?.reason).toBe('location_out_of_radius')
  })

  it('returns 409 when same event was posted within 5 seconds', async () => {
    const state = createSupabaseMock({
      role: 'owner',
      locationRequired: true,
      storeLocationLat: 35.681236,
      storeLocationLng: 139.767125,
      storeLocationRadiusMeters: 200,
      duplicateOccurredAt: '2026-04-16T00:00:02.000Z',
    })

    const { POST } = await import('../src/app/api/attendance/events/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'clock_in',
          staff_id: 'staff-target',
          business_date: '2026-04-16',
          occurred_at: '2026-04-16T00:00:04.000Z',
          location_lat: '35.681236',
          location_lng: '139.767125',
          location_accuracy_meters: '10',
          location_captured_at: '2026-04-16T00:00:03.000Z',
        }),
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ message: '同一打刻の短時間重複はできません。' })
    expect(state.insertedEvents).toHaveLength(0)
  })

  it('inserts attendance event with location audit fields when within radius', async () => {
    const state = createSupabaseMock({
      role: 'owner',
      locationRequired: true,
      storeLocationLat: 35.681236,
      storeLocationLng: 139.767125,
      storeLocationRadiusMeters: 300,
    })
    createAdminSupabaseClientMock.mockReturnValue(state.supabase)

    const { POST } = await import('../src/app/api/attendance/events/route')
    const response = await POST(
      new Request('http://localhost/api/attendance/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'clock_in',
          staff_id: 'staff-target',
          business_date: '2026-04-16',
          occurred_at: '2026-04-16T00:00:00.000Z',
          location_lat: '35.681236',
          location_lng: '139.767125',
          location_accuracy_meters: '8.6',
          location_captured_at: '2026-04-16T00:00:00.000Z',
        }),
      }),
    )

    expect(response.status).toBe(201)
    expect(state.insertedEvents).toHaveLength(1)
    expect(state.insertedEvents[0]).toEqual(
      expect.objectContaining({
        store_id: 'store-1',
        staff_id: 'staff-target',
        event_type: 'clock_in',
        location_lat: 35.681236,
        location_lng: 139.767125,
        location_accuracy_meters: 8.6,
        location_is_within_radius: true,
      }),
    )
    expect(recomputeAttendanceDailySummaryMock).toHaveBeenCalledTimes(1)
  })
})
