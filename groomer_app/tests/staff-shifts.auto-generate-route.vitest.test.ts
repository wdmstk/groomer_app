import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
  requireStoreMembershipWithPlan: requireStoreMembershipMock,
}))

function createSupabaseMock(options?: {
  horizonDays?: number
  shiftOptimizationEnabled?: boolean
  planCode?: 'light' | 'standard' | 'pro'
  existingShifts?: unknown[]
  closedRules?: unknown[]
  onShiftPlanDeleteIds?: (ids: string[]) => void
}) {
  const horizonDays = options?.horizonDays ?? 14
  const shiftOptimizationEnabled = options?.shiftOptimizationEnabled ?? false
  const planCode = options?.planCode ?? 'standard'
  const existingShifts = options?.existingShifts ?? []
  const closedRules = options?.closedRules ?? []

  return {
    from(table: string) {
      if (table === 'store_shift_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: { auto_shift_horizon_days: horizonDays, shift_optimization_enabled: shiftOptimizationEnabled },
                error: null,
              }),
            }
          },
        }
      }

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

      if (table === 'appointments') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              not() {
                return this
              },
              gte() {
                return this
              },
              lte() {
                return this
              },
              in() {
                return this
              },
              order: async () => ({ data: [], error: null }),
            }
          },
        }
      }

      if (table === 'staff_shift_plans') {
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
              then(resolve: (v: { data: unknown[]; error: null }) => void) {
                return resolve({ data: existingShifts, error: null })
              },
            }
          },
          insert: async () => ({ error: null }),
          delete() {
            return {
              eq() {
                return this
              },
              in(field?: unknown, values?: unknown) {
                if (field === 'id' && Array.isArray(values)) {
                  options?.onShiftPlanDeleteIds?.(values as string[])
                }
                return this
              },
              then(resolve: (v: { error: null }) => void) {
                return resolve({ error: null })
              },
            }
          },
        }
      }

      if (table === 'store_closed_rules' || table === 'staff_work_rules') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order: async () => ({ data: table === 'store_closed_rules' ? closedRules : [], error: null }),
              then(resolve: (v: { data: unknown[]; error: null }) => void) {
                return resolve({ data: table === 'store_closed_rules' ? closedRules : [], error: null })
              },
            }
          },
        }
      }

      if (table === 'staff_work_rule_slots') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order() {
                return this
              },
              then(resolve: (v: { data: unknown[]; error: null }) => void) {
                return resolve({ data: [], error: null })
              },
            }
          },
        }
      }

      if (table === 'staff_day_off_requests') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              in: async () => ({ data: [], error: null }),
            }
          },
        }
      }

      if (table === 'shift_auto_generate_runs') {
        return {
          insert() {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 'run-1' }, error: null }),
                }
              },
            }
          },
        }
      }

      if (table === 'shift_auto_generate_run_items') {
        return {
          insert: async () => ({ error: null }),
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
        }
      }

      if (table === 'shift_alerts') {
        return {
          delete() {
            return {
              eq() {
                return this
              },
              in() {
                return this
              },
              gte() {
                return this
              },
              lte: async () => ({ error: null }),
            }
          },
          insert: async () => ({ error: null }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('staff shifts auto-generate route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock(),
    })
  })

  it('returns 400 when to_date is before from_date', async () => {
    const { POST } = await import('../src/app/api/staff-shifts/auto-generate/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/auto-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '2026-04-20', to_date: '2026-04-19', mode: 'preview' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'to_date は from_date 以降で指定してください。' })
  })

  it('clamps range by store horizon setting and returns run summary', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({ horizonDays: 5 }),
    })

    const { POST } = await import('../src/app/api/staff-shifts/auto-generate/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/auto-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '2026-04-20', to_date: '2026-05-31', mode: 'preview' }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.from_date).toBe('2026-04-20')
    expect(payload.data.to_date).toBe('2026-04-24')
    expect(payload.data.horizon_days).toBe(5)
    expect(payload.data.run_id).toBe('run-1')
  })

  it('deletes shifts on closed days when applying auto-generate', async () => {
    const deletedIds: string[][] = []
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({
        horizonDays: 90,
        existingShifts: [
          {
            id: 'shift-closed-1',
            staff_id: 'staff-1',
            shift_date: '2026-04-20',
            start_at: '2026-04-20T09:00:00+09:00',
            end_at: '2026-04-20T18:00:00+09:00',
            planned_break_minutes: 60,
            source_type: 'manual',
            status: 'draft',
            note: null,
          },
        ],
        closedRules: [
          { rule_type: 'date', weekday: null, closed_date: '2026-04-20', is_active: true },
        ],
        onShiftPlanDeleteIds: (ids) => deletedIds.push(ids),
      }),
    })

    const { POST } = await import('../src/app/api/staff-shifts/auto-generate/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/auto-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '2026-04-20', to_date: '2026-04-20', mode: 'apply_draft' }),
      })
    )

    expect(response.status).toBe(200)
    expect(deletedIds.flat()).toContain('shift-closed-1')
  })

  it('returns 403 when optimized strategy is requested on non-pro plan', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({ planCode: 'standard', shiftOptimizationEnabled: true }),
    })

    const { POST } = await import('../src/app/api/staff-shifts/auto-generate/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/auto-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '2026-04-20', to_date: '2026-04-22', mode: 'preview', strategy: 'optimized' }),
      })
    )

    expect(response.status).toBe(403)
  })

  it('returns optimization scores for optimized strategy on pro plan', async () => {
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({ planCode: 'pro', shiftOptimizationEnabled: true }),
    })

    const { POST } = await import('../src/app/api/staff-shifts/auto-generate/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/auto-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from_date: '2026-04-20', to_date: '2026-04-22', mode: 'preview', strategy: 'optimized' }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.strategy).toBe('optimized')
    expect(typeof payload.data.total_score).toBe('number')
    expect(payload.data.score_breakdown).toBeTruthy()
    expect(Array.isArray(payload.data.alternatives)).toBe(true)
  })
})
