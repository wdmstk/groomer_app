import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
  requireStoreMembershipWithPlan: requireStoreMembershipMock,
}))

type ShiftRow = {
  id: string
  staff_id: string
  shift_date: string
  status: 'draft' | 'published'
  start_at: string
  end_at: string
  planned_break_minutes: number
  source_type: string
  note: string | null
  updated_at?: string
}

function createSupabaseMock(initialRow?: ShiftRow | null) {
  let shiftRow = initialRow
  const runItemsInsert = vi.fn(async () => ({ error: null }))

  const db = {
    runItemsInsert,
    from(table: string) {
      if (table === 'staff_shift_plans') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: shiftRow, error: null }),
            }
          },
          update(payload: Record<string, unknown>) {
            shiftRow = shiftRow ? ({ ...shiftRow, ...payload } as ShiftRow) : shiftRow
            return {
              eq() {
                return this
              },
              then(resolve: (value: { error: null }) => void) {
                resolve({ error: null })
              },
            }
          },
          delete() {
            return {
              eq() {
                return this
              },
              then(resolve: (value: { error: null }) => void) {
                shiftRow = null
                resolve({ error: null })
              },
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
          insert: runItemsInsert,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }

  return db
}

describe('staff shifts single routes history logging', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('logs history on PATCH update', async () => {
    const supabase = createSupabaseMock({
      id: 'shift-1',
      staff_id: 'staff-1',
      shift_date: '2026-04-16',
      status: 'draft',
      start_at: '2026-04-16T00:00:00.000Z',
      end_at: '2026-04-16T09:00:00.000Z',
      planned_break_minutes: 60,
      source_type: 'manual',
      note: null,
    })

    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase,
    })

    const { PATCH } = await import('../src/app/api/staff-shifts/[shift_id]/route')
    const response = await PATCH(
      new Request('http://localhost/api/staff-shifts/shift-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          shift_date: '2026-04-16',
          start_time: '10:00',
          end_time: '19:00',
          planned_break_minutes: 45,
        }),
      }),
      { params: Promise.resolve({ shift_id: 'shift-1' }) }
    )

    expect(response.status).toBe(200)
    expect(supabase.runItemsInsert).toHaveBeenCalledTimes(1)
    expect(supabase.runItemsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'updated',
        shift_plan_id: 'shift-1',
      })
    )
  })

  it('logs history on DELETE', async () => {
    const supabase = createSupabaseMock({
      id: 'shift-1',
      staff_id: 'staff-1',
      shift_date: '2026-04-16',
      status: 'draft',
      start_at: '2026-04-16T00:00:00.000Z',
      end_at: '2026-04-16T09:00:00.000Z',
      planned_break_minutes: 60,
      source_type: 'manual',
      note: null,
    })

    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase,
    })

    const { DELETE } = await import('../src/app/api/staff-shifts/[shift_id]/route')
    const response = await DELETE(new Request('http://localhost/api/staff-shifts/shift-1', { method: 'DELETE' }), {
      params: Promise.resolve({ shift_id: 'shift-1' }),
    })

    expect(response.status).toBe(200)
    expect(supabase.runItemsInsert).toHaveBeenCalledTimes(1)
    expect(supabase.runItemsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'deleted',
        shift_plan_id: null,
      })
    )
  })

  it('logs history on publish POST', async () => {
    const supabase = createSupabaseMock({
      id: 'shift-1',
      staff_id: 'staff-1',
      shift_date: '2026-04-16',
      status: 'draft',
      start_at: '2026-04-16T00:00:00.000Z',
      end_at: '2026-04-16T09:00:00.000Z',
      planned_break_minutes: 60,
      source_type: 'manual',
      note: null,
    })

    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase,
    })

    const form = new FormData()
    form.set('redirect_to', '/staffs?tab=shift')

    const { POST } = await import('../src/app/api/staff-shifts/[shift_id]/publish/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/shift-1/publish', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ shift_id: 'shift-1' }) }
    )

    expect(response.status).toBe(307)
    expect(supabase.runItemsInsert).toHaveBeenCalledTimes(1)
    expect(supabase.runItemsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'updated',
        shift_plan_id: 'shift-1',
      })
    )
  })
})
