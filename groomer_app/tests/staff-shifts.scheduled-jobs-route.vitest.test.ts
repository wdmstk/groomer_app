import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreMembershipMock } = vi.hoisted(() => ({
  requireStoreMembershipMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-membership', () => ({
  requireStoreMembership: requireStoreMembershipMock,
  requireStoreMembershipWithPlan: requireStoreMembershipMock,
}))

function createSupabaseMock() {
  return {
    from(table: string) {
      if (table === 'shift_scheduled_jobs') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order: async () => ({
                data: [
                  {
                    id: 'job-1',
                    is_active: true,
                    frequency: 'weekly',
                    run_at_local_time: '09:00:00',
                    run_weekday: 1,
                    target_horizon_days: 30,
                    mode: 'apply_draft',
                  },
                ],
                error: null,
              }),
              maybeSingle: async () => ({ data: { id: 'job-1', frequency: 'weekly', run_weekday: 1 }, error: null }),
            }
          },
          insert() {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 'job-1' }, error: null }),
                }
              },
            }
          },
          update() {
            return {
              eq() {
                return this
              },
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 'job-1', is_active: true }, error: null }),
                }
              },
            }
          },
          delete() {
            return {
              eq() {
                return this
              },
              then(resolve: (value: { error: null }) => void) {
                return resolve({ error: null })
              },
            }
          },
        }
      }

      if (table === 'shift_scheduled_job_runs') {
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
              gte() {
                return this
              },
              lte: async () => ({
                data: [{ id: 'run-1', status: 'success' }],
                error: null,
              }),
              then(resolve: (value: { data: unknown[]; error: null }) => void) {
                return resolve({ data: [{ id: 'run-1', status: 'success' }], error: null })
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('staff-shifts scheduled jobs routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreMembershipMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
      supabase: createSupabaseMock(),
    })
  })

  it('lists scheduled jobs', async () => {
    const { GET } = await import('../src/app/api/staff-shifts/scheduled-jobs/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data[0].id).toBe('job-1')
  })

  it('validates weekly job payload', async () => {
    const { POST } = await import('../src/app/api/staff-shifts/scheduled-jobs/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/scheduled-jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frequency: 'weekly', run_at_local_time: '09:00', target_horizon_days: 30 }),
      })
    )

    expect(response.status).toBe(400)
  })

  it('lists scheduled job runs', async () => {
    const { GET } = await import('../src/app/api/staff-shifts/scheduled-jobs/runs/route')
    const response = await GET(new Request('http://localhost/api/staff-shifts/scheduled-jobs/runs?from=2026-04-01&to=2026-04-30'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data[0].id).toBe('run-1')
  })

  it('creates job via form-data and redirects', async () => {
    const formData = new FormData()
    formData.set('frequency', 'weekly')
    formData.set('run_at_local_time', '09:00')
    formData.set('run_weekday', '1')
    formData.set('target_horizon_days', '30')
    formData.set('mode', 'apply_draft')
    formData.set('is_active', '1')
    formData.set('redirect_to', '/staffs?tab=shift-settings')

    const { POST } = await import('../src/app/api/staff-shifts/scheduled-jobs/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/scheduled-jobs', {
        method: 'POST',
        body: formData,
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=shift-settings')
  })

  it('updates job via POST _method=patch and redirects', async () => {
    const formData = new FormData()
    formData.set('_method', 'patch')
    formData.set('is_active', '1')
    formData.set('frequency', 'weekly')
    formData.set('run_at_local_time', '10:30')
    formData.set('run_weekday', '2')
    formData.set('target_horizon_days', '21')
    formData.set('mode', 'apply_draft')
    formData.set('redirect_to', '/staffs?tab=shift-settings')

    const { POST } = await import('../src/app/api/staff-shifts/scheduled-jobs/[job_id]/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/scheduled-jobs/job-1', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ job_id: 'job-1' }) }
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=shift-settings')
  })

  it('deletes job via POST _method=delete and redirects', async () => {
    const formData = new FormData()
    formData.set('_method', 'delete')
    formData.set('redirect_to', '/staffs?tab=shift-settings')

    const { POST } = await import('../src/app/api/staff-shifts/scheduled-jobs/[job_id]/route')
    const response = await POST(
      new Request('http://localhost/api/staff-shifts/scheduled-jobs/job-1', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ job_id: 'job-1' }) }
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/staffs?tab=shift-settings')
  })
})
