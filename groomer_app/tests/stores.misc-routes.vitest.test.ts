import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock, createStoreScopedClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
  setActiveStoreIdCookie: vi.fn(async () => undefined),
}))

function createStoreScopedMembershipMock(role: string | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user: role ? { id: 'user-1' } : null } }),
    },
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
            }
          },
        }
      }
      if (table === 'stores') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: {
                  public_reserve_slot_days: 7,
                  public_reserve_slot_interval_minutes: 30,
                  public_reserve_slot_buffer_minutes: 15,
                  public_reserve_business_start_hour_jst: 9,
                  public_reserve_business_end_hour_jst: 19,
                  public_reserve_min_lead_minutes: 60,
                },
                error: null,
              }),
            }
          },
          update() {
            return {
              eq: async () => ({ error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('stores misc routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-147
  it('POST /api/stores/active returns 400 when storeId is missing', async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: { store_id: 'store-1' }, error: null }),
        }),
      }),
    })

    const { POST } = await import('../src/app/api/stores/active/route')
    const response = await POST(
      new Request('http://localhost/api/stores/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'storeId is required.' })
  })

  // TRACE-148
  it('POST /api/stores/member-card-settings returns 401 when user is not authenticated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreScopedMembershipMock(null),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/stores/member-card-settings/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/stores/member-card-settings', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  // TRACE-149
  it('POST /api/stores/ltv-rank-settings returns 400 when thresholds are in invalid order', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreScopedMembershipMock('owner'),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/stores/ltv-rank-settings/route')
    const form = new FormData()
    form.set('ltv_gold_annual_sales_threshold', '100')
    form.set('ltv_silver_annual_sales_threshold', '200')
    form.set('ltv_bronze_annual_sales_threshold', '300')
    form.set('ltv_gold_visit_count_threshold', '12')
    form.set('ltv_silver_visit_count_threshold', '6')
    form.set('ltv_bronze_visit_count_threshold', '3')
    const response = await POST(
      new Request('http://localhost/api/stores/ltv-rank-settings', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '売上しきい値は ゴールド >= シルバー >= ブロンズ の順で入力してください。',
    })
  })

  // TRACE-150
  it('POST /api/stores/public-reserve-slot-settings returns 400 when business hours are invalid', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createStoreScopedMembershipMock('owner'),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/stores/public-reserve-slot-settings/route')
    const form = new FormData()
    form.set('public_reserve_slot_days', '7')
    const response = await POST(
      new Request('http://localhost/api/stores/public-reserve-slot-settings', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '営業時間の保存値が不正です。開始時刻・終了時刻を確認してください。',
    })
  })
})
