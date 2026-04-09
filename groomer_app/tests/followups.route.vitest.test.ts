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
})
