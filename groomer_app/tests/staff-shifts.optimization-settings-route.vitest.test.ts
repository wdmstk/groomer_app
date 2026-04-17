import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
  requireStoreMembershipWithPlan: requireStoreMembershipMock,
}))

function createSupabaseMock(planCode: 'standard' | 'pro' = 'pro') {
  const state = {
    shiftSettingsUpserts: [] as Array<Record<string, unknown>>,
    profileUpserts: [] as Array<Record<string, unknown>>,
  }
  return {
    state,
    from(table: string) {
      if (table === 'store_subscriptions') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: {
                  plan_code: planCode,
                  hotel_option_enabled: false,
                  notification_option_enabled: false,
                  ai_plan_code: 'none',
                  hotel_option_effective: false,
                  notification_option_effective: false,
                  ai_plan_code_effective: 'none',
                },
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'store_notification_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: null, error: null }),
            }
          },
        }
      }

      if (table === 'store_shift_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: { shift_optimization_enabled: false, scheduled_auto_run_enabled: false },
                error: null,
              }),
            }
          },
          upsert: async (payload: Record<string, unknown>) => {
            state.shiftSettingsUpserts.push(payload)
            return { error: null }
          },
        }
      }

      if (table === 'shift_optimization_profiles') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: {
                  fairness_weight: 0.35,
                  preferred_shift_weight: 0.25,
                  reservation_coverage_weight: 0.3,
                  workload_health_weight: 0.1,
                },
                error: null,
              }),
            }
          },
          upsert: async (payload: Record<string, unknown>) => {
            state.profileUpserts.push(payload)
            return { error: null }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('staff-shifts settings optimization route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
      supabase: createSupabaseMock('pro'),
    })
  })

  it('returns optimization settings', async () => {
    const { GET } = await import('../src/app/api/staff-shifts/settings/optimization/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.weights.fairness_weight).toBe(0.35)
  })

  it('rejects weight update for non-pro plan', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
      supabase: createSupabaseMock('standard'),
    })

    const { PUT } = await import('../src/app/api/staff-shifts/settings/optimization/route')
    const response = await PUT(
      new Request('http://localhost/api/staff-shifts/settings/optimization', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shift_optimization_enabled: true, fairness_weight: 0.35, preferred_shift_weight: 0.25, reservation_coverage_weight: 0.3, workload_health_weight: 0.1 }),
      })
    )

    expect(response.status).toBe(403)
  })

  it('accepts form-data, prefers checked value, and redirects', async () => {
    const supabase = createSupabaseMock('pro')
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
      supabase,
    })

    const formData = new FormData()
    formData.append('shift_optimization_enabled', '0')
    formData.append('shift_optimization_enabled', '1')
    formData.append('scheduled_auto_run_enabled', '0')
    formData.append('redirect_to', '/staffs?tab=shift-settings')

    const { POST } = await import('../src/app/api/staff-shifts/settings/optimization/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/settings/optimization', {
        method: 'POST',
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=shift-settings')
    expect(supabase.state.shiftSettingsUpserts.at(-1)).toMatchObject({
      store_id: 'store-1',
      shift_optimization_enabled: true,
      scheduled_auto_run_enabled: false,
    })
  })
})
