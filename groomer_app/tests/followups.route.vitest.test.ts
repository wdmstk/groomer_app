import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getFollowupRouteContextMock } = vi.hoisted(() => ({
  getFollowupRouteContextMock: vi.fn(),
}))

vi.mock('@/lib/followups/shared', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/followups/shared')>(
    '../src/lib/followups/shared'
  )
  return {
    ...actual,
    getFollowupRouteContext: getFollowupRouteContextMock,
  }
})

type QueryCall = {
  method: 'eq' | 'gte' | 'lt'
  column: string
  value: string
}

function createTaskQueryRecorder() {
  const calls: QueryCall[] = []
  const query = {
    data: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
    select() {
      return this
    },
    order() {
      return this
    },
    eq(column: string, value: string) {
      calls.push({ method: 'eq', column, value })
      return this
    },
    gte(column: string, value: string) {
      calls.push({ method: 'gte', column, value })
      return this
    },
    lt(column: string, value: string) {
      calls.push({ method: 'lt', column, value })
      return this
    },
  }

  return { query, calls }
}

function createEqOnlyQuery(data: unknown) {
  return {
    data,
    error: null as { message: string } | null,
    select() {
      return this
    },
    eq() {
      return this
    },
    order() {
      return this
    },
  }
}

function createTemplateQuery() {
  return {
    data: [] as Array<{ template_key: string; body: string }>,
    error: null as { message: string } | null,
    select() {
      return this
    },
    eq() {
      return this
    },
  }
}

function createSupabaseMock(taskQuery: ReturnType<typeof createTaskQueryRecorder>['query']) {
  return {
    from(table: string) {
      if (table === 'customer_followup_tasks') {
        return taskQuery
      }
      if (table === 'staffs') {
        return createEqOnlyQuery([{ user_id: 'user-1', full_name: '担当A' }])
      }
      if (table === 'notification_templates') {
        return createTemplateQuery()
      }
      return createEqOnlyQuery([])
    },
  }
}

describe('followups route GET query filters', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // TRACE-050
  it('applies assignee=me + due=overdue + window_days filters together', async () => {
    const { query, calls } = createTaskQueryRecorder()
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock(query),
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')
    const response = await GET(
      new Request(
        'http://localhost/api/followups?assignee=me&due=overdue&window_days=7&include_candidates=0'
      )
    )

    expect(response.status).toBe(200)
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', column: 'store_id', value: 'store-1' },
        { method: 'eq', column: 'assigned_user_id', value: 'user-1' },
        { method: 'lt', column: 'due_on', value: '2026-04-10' },
      ])
    )

    const windowCall = calls.find((call) => call.method === 'gte' && call.column === 'recommended_at')
    expect(windowCall).toBeTruthy()
    expect(windowCall?.value.startsWith('2026-04-03')).toBe(true)
  })

  // TRACE-051
  it('does not apply recommended_at gte when window_days is all', async () => {
    const { query, calls } = createTaskQueryRecorder()
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock(query),
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')
    const response = await GET(
      new Request('http://localhost/api/followups?window_days=all&include_candidates=false')
    )

    expect(response.status).toBe(200)
    const hasWindowFilter = calls.some(
      (call) => call.method === 'gte' && call.column === 'recommended_at'
    )
    expect(hasWindowFilter).toBe(false)
  })

  // TRACE-052
  it('applies due=today equality filter', async () => {
    const { query, calls } = createTaskQueryRecorder()
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock(query),
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')
    const response = await GET(
      new Request('http://localhost/api/followups?due=today&assignee=user-2&include_candidates=0')
    )

    expect(response.status).toBe(200)
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', column: 'assigned_user_id', value: 'user-2' },
        { method: 'eq', column: 'due_on', value: '2026-04-10' },
      ])
    )
  })

  // TRACE-053
  it('ignores invalid status query value and keeps request safe', async () => {
    const { query, calls } = createTaskQueryRecorder()
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock(query),
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')
    const response = await GET(
      new Request('http://localhost/api/followups?status=invalid_status&include_candidates=0')
    )

    expect(response.status).toBe(200)
    const hasStatusFilter = calls.some((call) => call.method === 'eq' && call.column === 'status')
    expect(hasStatusFilter).toBe(false)
  })

  // TRACE-054
  it('applies refollow cooldown policy when include_candidates=true', async () => {
    const tasksQuery = {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
      select() {
        return this
      },
      order() {
        return this
      },
      eq() {
        return this
      },
      gte() {
        return this
      },
      lt() {
        return this
      },
      in() {
        return this
      },
    }

    const activeTasks = [
      {
        customer_id: 'customer-blocked',
        snoozed_until: null,
        status: 'resolved_no_need',
        resolved_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      },
      {
        customer_id: 'customer-released',
        snoozed_until: null,
        status: 'resolved_no_need',
        resolved_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ]

    const supabase = {
      from(table: string) {
        if (table === 'customer_followup_tasks') {
          return {
            ...tasksQuery,
            select(columns?: string) {
              if (columns?.includes('customers(')) {
                return tasksQuery
              }
              return {
                ...tasksQuery,
                data: activeTasks,
              }
            },
          }
        }
        if (table === 'customer_followup_events') {
          return {
            ...tasksQuery,
            data: [],
          }
        }
        if (table === 'staffs') {
          return {
            ...tasksQuery,
            data: [{ id: 'staff-1', user_id: 'user-1', full_name: '担当A' }],
          }
        }
        if (table === 'notification_templates') {
          return {
            ...tasksQuery,
            data: [],
          }
        }
        if (table === 'customers') {
          return {
            ...tasksQuery,
            data: [
              { id: 'customer-blocked', full_name: 'クールダウン中 顧客', phone_number: null, line_id: null },
              { id: 'customer-released', full_name: '再候補 顧客', phone_number: null, line_id: null },
            ],
          }
        }
        if (table === 'visits') {
          return {
            ...tasksQuery,
            data: [
              {
                customer_id: 'customer-blocked',
                visit_date: '2026-01-01T00:00:00.000Z',
                appointment_id: null,
              },
              {
                customer_id: 'customer-released',
                visit_date: '2026-01-01T00:00:00.000Z',
                appointment_id: null,
              },
            ],
          }
        }
        if (table === 'appointments') {
          return {
            ...tasksQuery,
            data: [],
          }
        }
        if (table === 'pets') {
          return {
            ...tasksQuery,
            data: [],
          }
        }
        if (table === 'store_customer_management_settings') {
          return {
            ...tasksQuery,
            data: {
              followup_snoozed_refollow_days: 7,
              followup_no_need_refollow_days: 30,
              followup_lost_refollow_days: 90,
            },
            maybeSingle() {
              return this
            },
          }
        }
        return {
          ...tasksQuery,
          data: [],
        }
      },
    }

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')
    const response = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      candidates: Array<{ customer_id: string; customer_name: string }>
    }
    expect(payload.candidates.map((row) => row.customer_id)).toContain('customer-released')
    expect(payload.candidates.map((row) => row.customer_id)).not.toContain('customer-blocked')
  })

  // TRACE-055
  it('applies window_days boundary to candidates when include_candidates=true', async () => {
    const tasksQuery = {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
      select() {
        return this
      },
      order() {
        return this
      },
      eq() {
        return this
      },
      gte() {
        return this
      },
      lt() {
        return this
      },
      in() {
        return this
      },
    }

    const supabase = {
      from(table: string) {
        if (table === 'customer_followup_tasks') {
          return {
            ...tasksQuery,
            select(columns?: string) {
              if (columns?.includes('customers(')) {
                return tasksQuery
              }
              return {
                ...tasksQuery,
                data: [],
              }
            },
          }
        }
        if (table === 'customer_followup_events') {
          return { ...tasksQuery, data: [] }
        }
        if (table === 'staffs') {
          return { ...tasksQuery, data: [{ id: 'staff-1', user_id: 'user-1', full_name: '担当A' }] }
        }
        if (table === 'notification_templates') {
          return { ...tasksQuery, data: [] }
        }
        if (table === 'customers') {
          return {
            ...tasksQuery,
            data: [
              { id: 'customer-in-window', full_name: '直近候補 顧客', phone_number: null, line_id: null },
              { id: 'customer-out-window', full_name: '期間外候補 顧客', phone_number: null, line_id: null },
            ],
          }
        }
        if (table === 'visits') {
          return {
            ...tasksQuery,
            data: [
              // 45日後が 2026-04-05 となるため window_days=7 で対象内
              { customer_id: 'customer-in-window', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null },
              // 45日後が 2026-02-15 となるため window_days=7 では対象外
              { customer_id: 'customer-out-window', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null },
            ],
          }
        }
        if (table === 'appointments') {
          return { ...tasksQuery, data: [] }
        }
        if (table === 'pets') {
          return { ...tasksQuery, data: [] }
        }
        if (table === 'store_customer_management_settings') {
          return {
            ...tasksQuery,
            data: {
              followup_snoozed_refollow_days: 7,
              followup_no_need_refollow_days: 60,
              followup_lost_refollow_days: 90,
            },
            maybeSingle() {
              return this
            },
          }
        }
        return { ...tasksQuery, data: [] }
      },
    }

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseInWindow = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7')
    )
    expect(responseInWindow.status).toBe(200)
    const payloadInWindow = (await responseInWindow.json()) as {
      candidates: Array<{ customer_id: string }>
    }
    expect(payloadInWindow.candidates.map((row) => row.customer_id)).toContain('customer-in-window')
    expect(payloadInWindow.candidates.map((row) => row.customer_id)).not.toContain('customer-out-window')

    const responseAllWindow = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseAllWindow.status).toBe(200)
    const payloadAllWindow = (await responseAllWindow.json()) as {
      candidates: Array<{ customer_id: string }>
    }
    expect(payloadAllWindow.candidates.map((row) => row.customer_id)).toContain('customer-in-window')
    expect(payloadAllWindow.candidates.map((row) => row.customer_id)).toContain('customer-out-window')
  })
})
