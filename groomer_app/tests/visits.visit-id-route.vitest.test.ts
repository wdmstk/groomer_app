import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

function buildJsonRequest(body: unknown) {
  return new Request('http://localhost/api/visits/visit-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createVisitIdSupabaseMock(options?: {
  customerExists?: boolean
  staffExists?: boolean
  appointmentExists?: boolean
  duplicateVisitId?: string | null
}) {
  const customerExists = options?.customerExists ?? true
  const staffExists = options?.staffExists ?? true
  const appointmentExists = options?.appointmentExists ?? true
  const duplicateVisitId = options?.duplicateVisitId ?? null

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'customers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: customerExists ? { id: 'customer-1' } : null, error: null }),
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
              maybeSingle: async () => ({ data: staffExists ? { id: 'staff-1' } : null, error: null }),
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
              maybeSingle: async () => ({ data: appointmentExists ? { id: 'appt-1' } : null, error: null }),
            }
          },
        }
      }

      if (table === 'visits') {
        return {
          select(columns?: string) {
            if (columns === 'id') {
              return {
                eq() {
                  return this
                },
                neq() {
                  return this
                },
                maybeSingle: async () => ({
                  data: duplicateVisitId ? { id: duplicateVisitId } : null,
                  error: null,
                }),
              }
            }
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: {
                  id: 'visit-1',
                  customer_id: 'customer-1',
                  appointment_id: 'appt-0',
                  staff_id: 'staff-1',
                  visit_date: '2026-04-09T01:00:00.000Z',
                  menu: 'シャンプー',
                  total_amount: 5000,
                  notes: null,
                },
                error: null,
              }),
            }
          },
          update() {
            return {
              eq() {
                return this
              },
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'visit-1',
                      customer_id: 'customer-1',
                      appointment_id: 'appt-1',
                      staff_id: 'staff-1',
                      visit_date: '2026-04-09T01:00:00.000Z',
                      menu: 'シャンプー',
                      total_amount: 5000,
                      notes: null,
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('visits [visit_id] route PUT', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createVisitIdSupabaseMock(),
      storeId: 'store-1',
    })
  })

  it('returns 400 when menu is missing', async () => {
    const { PUT } = await import('../src/app/api/visits/[visit_id]/route')
    const response = await PUT(
      buildJsonRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        appointment_id: 'appt-1',
        visit_date: '2026-04-09T10:00',
        total_amount: 5500,
      }),
      { params: Promise.resolve({ visit_id: 'visit-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '施術メニューは必須です。',
    })
  })

  // TRACE-012
  it('returns 409 when another visit already uses the same appointment', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createVisitIdSupabaseMock({ duplicateVisitId: 'visit-dup-2' }),
      storeId: 'store-1',
    })

    const { PUT } = await import('../src/app/api/visits/[visit_id]/route')
    const response = await PUT(
      buildJsonRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        appointment_id: 'appt-1',
        visit_date: '2026-04-09T10:00',
        menu: 'シャンプー',
        total_amount: 5500,
      }),
      { params: Promise.resolve({ visit_id: 'visit-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      message: 'この予約にはすでに来店履歴が登録されています。',
      visit_id: 'visit-dup-2',
    })
  })
})
