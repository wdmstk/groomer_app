import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
  requireStoreMembershipWithPlan: requireStoreMembershipMock,
}))

function createSupabaseMock(options?: {
  targetIds?: string[]
  targetRows?: Array<{
    id: string
    staff_id?: string | null
    shift_date?: string
    status?: string
    start_at?: string
    end_at?: string
    planned_break_minutes?: number
    source_type?: string
    note?: string | null
  }>
  selectErrorMessage?: string | null
  updateErrorMessage?: string | null
  deleteErrorMessage?: string | null
  onUpdateStatus?: (status: string) => void
  onDeleteIds?: (ids: string[]) => void
}) {
  const targetIds = options?.targetIds ?? []
  const targetRows =
    options?.targetRows ??
    targetIds.map((id) => ({
      id,
      staff_id: 'staff-1',
      shift_date: '2026-04-01',
      status: 'draft',
      start_at: '2026-04-01T00:00:00.000Z',
      end_at: '2026-04-01T01:00:00.000Z',
      planned_break_minutes: 0,
      source_type: 'manual',
      note: null,
    }))
  const selectErrorMessage = options?.selectErrorMessage ?? null
  const updateErrorMessage = options?.updateErrorMessage ?? null
  const deleteErrorMessage = options?.deleteErrorMessage ?? null

  const runInsert = vi.fn(async () => ({ data: { id: 'run-1' }, error: null }))
  const runItemsInsert = vi.fn(async () => ({ error: null }))

  return {
    runInsert,
    runItemsInsert,
    from(table: string) {
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
              lte: async () => ({
                data: selectErrorMessage ? null : targetRows,
                error: selectErrorMessage ? { message: selectErrorMessage } : null,
              }),
            }
          },
          update(payload: { status?: string }) {
            if (typeof payload.status === 'string') options?.onUpdateStatus?.(payload.status)
            return {
              eq() {
                return this
              },
              in: async () => ({
                error: updateErrorMessage ? { message: updateErrorMessage } : null,
              }),
            }
          },
          delete() {
            return {
              eq() {
                return this
              },
              in(_field: string, ids: string[]) {
                options?.onDeleteIds?.(ids)
                return Promise.resolve({
                  error: deleteErrorMessage ? { message: deleteErrorMessage } : null,
                })
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
                  maybeSingle: runInsert,
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
}

describe('staff shifts bulk route', () => {
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

  it('returns 400 when action_type is invalid', async () => {
    const { POST } = await import('../src/app/api/staff-shifts/bulk/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action_type: 'invalid',
          from_date: '2026-04-01',
          to_date: '2026-04-30',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'action_type は publish/unpublish/delete を指定してください。',
    })
  })

  it('publishes target range and redirects for form post', async () => {
    const statuses: string[] = []
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({
        targetIds: ['shift-1', 'shift-2'],
        onUpdateStatus: (status) => statuses.push(status),
      }),
    })

    const form = new FormData()
    form.set('action_type', 'publish')
    form.set('from_date', '2026-04-01')
    form.set('to_date', '2026-04-30')
    form.set('redirect_to', '/staffs?tab=shift&shift_from=2026-04-01&shift_to=2026-04-30')

    const { POST } = await import('../src/app/api/staff-shifts/bulk/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/bulk', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/staffs?tab=shift&shift_from=2026-04-01&shift_to=2026-04-30'
    )
    expect(statuses).toEqual(['published'])
  })

  it('deletes target range and returns affected count for json request', async () => {
    const deletedIdBatches: string[][] = []
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      supabase: createSupabaseMock({
        targetIds: ['shift-1', 'shift-2', 'shift-3'],
        onDeleteIds: (ids) => deletedIdBatches.push(ids),
      }),
    })

    const { POST } = await import('../src/app/api/staff-shifts/bulk/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action_type: 'delete',
          from_date: '2026-04-01',
          to_date: '2026-04-30',
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { affected_count: 3 },
    })
    expect(deletedIdBatches).toEqual([['shift-1', 'shift-2', 'shift-3']])
  })
})
