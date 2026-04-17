import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
}))

type Row = Record<string, unknown>

function createSupabaseMock() {
  const upsertRows: Row[] = []
  const deletedTables: string[] = []
  const insertedClosedRules: Row[] = []
  const insertedBlockedDates: Row[] = []

  const db = {
    from(table: string) {
      if (table === 'store_shift_settings') {
        return {
          upsert: async (payload: Row) => {
            upsertRows.push(payload)
            return { error: null }
          },
        }
      }

      if (table === 'store_closed_rules') {
        return {
          delete() {
            return {
              eq: async () => {
                deletedTables.push(table)
                return { error: null }
              },
            }
          },
          insert: async (rows: Row[]) => {
            insertedClosedRules.push(...rows)
            return { error: null }
          },
        }
      }

      if (table === 'store_public_reserve_blocked_dates') {
        return {
          delete() {
            return {
              eq: async () => {
                deletedTables.push(table)
                return { error: null }
              },
            }
          },
          insert: async (rows: Row[]) => {
            insertedBlockedDates.push(...rows)
            return { error: null }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }

  requireStoreMembershipMock.mockResolvedValue({
    ok: true,
    role: 'owner',
    storeId: 'store-1',
    user: { id: 'user-1' },
    supabase: db,
  })

  return { upsertRows, deletedTables, insertedClosedRules, insertedBlockedDates }
}

describe('stores shift-attendance-settings route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 422 when location_required=true and lat/lng are missing', async () => {
    createSupabaseMock()

    const form = new FormData()
    form.set('attendance_punch_enabled', 'on')
    form.set('attendance_location_required', 'on')

    const { POST } = await import('../src/app/api/stores/shift-attendance-settings/route')
    const response = await POST(
      new Request('http://localhost/api/stores/shift-attendance-settings', {
        method: 'POST',
        body: form,
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      message: '位置情報必須を有効にする場合は、基準緯度・基準経度を正しく設定してください。',
    })
  })

  it('saves attendance settings and redirects when redirect_to is safe', async () => {
    const state = createSupabaseMock()

    const form = new FormData()
    form.set('attendance_punch_enabled', 'on')
    form.set('attendance_location_required', 'on')
    form.set('attendance_location_lat', '35.681236')
    form.set('attendance_location_lng', '139.767125')
    form.set('attendance_location_radius_meters', '350')
    form.set('redirect_to', '/settings?tab=operations')

    const { POST } = await import('../src/app/api/stores/shift-attendance-settings/route')
    const response = await POST(
      new Request('http://localhost/api/stores/shift-attendance-settings', {
        method: 'POST',
        body: form,
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/settings?tab=operations')
    expect(state.upsertRows).toHaveLength(1)
    expect(state.upsertRows[0]).toEqual(
      expect.objectContaining({
        store_id: 'store-1',
        attendance_punch_enabled: true,
        attendance_location_required: true,
        attendance_location_lat: 35.681236,
        attendance_location_lng: 139.767125,
        attendance_location_radius_meters: 350,
      }),
    )
  })

  it('replaces closed rules and blocked dates when closed day inputs are provided', async () => {
    const state = createSupabaseMock()

    const form = new FormData()
    form.append('closed_weekdays', '0')
    form.append('closed_weekdays', '2')
    form.set('closed_dates_text', '2026-05-03\n2026-05-04')

    const { POST } = await import('../src/app/api/stores/shift-attendance-settings/route')
    const response = await POST(
      new Request('http://localhost/api/stores/shift-attendance-settings', {
        method: 'POST',
        body: form,
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })

    expect(state.deletedTables).toEqual(
      expect.arrayContaining(['store_closed_rules', 'store_public_reserve_blocked_dates']),
    )
    expect(state.insertedClosedRules).toHaveLength(4)
    expect(state.insertedClosedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_type: 'weekday', weekday: 0 }),
        expect.objectContaining({ rule_type: 'weekday', weekday: 2 }),
        expect.objectContaining({ rule_type: 'date', closed_date: '2026-05-03' }),
        expect.objectContaining({ rule_type: 'date', closed_date: '2026-05-04' }),
      ]),
    )
    expect(state.insertedBlockedDates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date_key: '2026-05-03' }),
        expect.objectContaining({ date_key: '2026-05-04' }),
      ]),
    )
  })
})
