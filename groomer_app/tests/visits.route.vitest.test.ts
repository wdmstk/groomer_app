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

function buildFormRequest(values: Record<string, string | undefined>) {
  const formData = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.set(key, value)
    }
  })
  return new Request('http://localhost/api/visits', {
    method: 'POST',
    body: formData,
  })
}

function createPostSupabaseMock(options?: {
  customerExists?: boolean
  staffExists?: boolean
  appointmentExists?: boolean
  existingVisitId?: string | null
}) {
  const customerExists = options?.customerExists ?? true
  const staffExists = options?.staffExists ?? true
  const appointmentExists = options?.appointmentExists ?? true
  const existingVisitId = options?.existingVisitId ?? null

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
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: existingVisitId ? { id: existingVisitId } : null,
                error: null,
              }),
            }
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'visit-new',
                      customer_id: 'customer-1',
                      appointment_id: null,
                      staff_id: 'staff-1',
                      visit_date: '2026-04-09T01:00:00.000Z',
                      menu: 'シャンプー',
                      total_amount: 5500,
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

describe('visits route POST', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPostSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-010
  it('returns 400 when customer_id is missing', async () => {
    const { POST } = await import('../src/app/api/visits/route')
    const response = await POST(
      buildFormRequest({
        staff_id: 'staff-1',
        visit_date: '2026-04-09T10:00',
        menu: 'シャンプー',
        total_amount: '5500',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '顧客の選択は必須です。',
    })
  })

  it('returns 400 when store consistency check fails', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPostSupabaseMock({ customerExists: false }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/visits/route')
    const response = await POST(
      buildFormRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        visit_date: '2026-04-09T10:00',
        menu: 'シャンプー',
        total_amount: '5500',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '顧客・担当・予約の店舗整合性が不正です。',
    })
  })

  // TRACE-037
  it('returns 400 when visit_date is invalid format', async () => {
    const { POST } = await import('../src/app/api/visits/route')
    const response = await POST(
      buildFormRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        visit_date: 'invalid-date',
        menu: 'シャンプー',
        total_amount: '5500',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '来店日時は必須です。',
    })
  })

  // TRACE-040
  it('returns 400 when total_amount is not numeric', async () => {
    const { POST } = await import('../src/app/api/visits/route')
    const response = await POST(
      buildFormRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        visit_date: '2026-04-09T10:00',
        menu: 'シャンプー',
        total_amount: 'abc',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '合計金額は数値で入力してください。',
    })
  })

  // TRACE-011
  it('redirects to existing visit when appointment already has a visit', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createPostSupabaseMock({ existingVisitId: 'visit-existing-1' }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/visits/route')
    const response = await POST(
      buildFormRequest({
        customer_id: 'customer-1',
        staff_id: 'staff-1',
        appointment_id: 'appt-1',
        visit_date: '2026-04-09T10:00',
        menu: 'シャンプー',
        total_amount: '5500',
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/visits?tab=list&edit=visit-existing-1'
    )
  })
})

function createGetSupabaseMock(options?: {
  rows?: Array<Record<string, unknown>>
  errorMessage?: string | null
}) {
  const rows = options?.rows ?? [{ id: 'visit-1', menu: 'シャンプー' }]
  const errorMessage = options?.errorMessage ?? null

  return {
    from(table: string) {
      if (table !== 'visits') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq() {
              return this
            },
            order: async () => ({
              data: errorMessage ? null : rows,
              error: errorMessage ? { message: errorMessage } : null,
            }),
          }
        },
      }
    },
  }
}

describe('visits route GET', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createGetSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-109
  it('returns visit list', async () => {
    const { GET } = await import('../src/app/api/visits/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'visit-1', menu: 'シャンプー' }])
  })

  // TRACE-110
  it('returns 500 when visit list query fails', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createGetSupabaseMock({ errorMessage: 'visits select failed' }),
      storeId: 'store-1',
    })
    const { GET } = await import('../src/app/api/visits/route')
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'visits select failed' })
  })
})
