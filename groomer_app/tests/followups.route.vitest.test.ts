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

function createChainQuery<T>(data: T) {
  return {
    data,
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
    maybeSingle() {
      return this
    },
  }
}

function createCandidateSupabaseMock(params: {
  taskRows?: Array<Record<string, unknown>>
  activeTaskRows: Array<Record<string, unknown>>
  customers: Array<Record<string, unknown>>
  visits: Array<Record<string, unknown>>
  appointments?: Array<Record<string, unknown>>
  pets?: Array<Record<string, unknown>>
  settings: {
    followup_snoozed_refollow_days: number
    followup_no_need_refollow_days: number
    followup_lost_refollow_days: number
  }
}) {
  return {
    from(table: string) {
      if (table === 'customer_followup_tasks') {
        return {
          ...createChainQuery(params.taskRows ?? []),
          select(columns?: string) {
            if (columns?.includes('customers(')) {
              return createChainQuery(params.taskRows ?? [])
            }
            return createChainQuery(params.activeTaskRows)
          },
        }
      }
      if (table === 'customer_followup_events') {
        return createChainQuery([])
      }
      if (table === 'staffs') {
        return createChainQuery([{ id: 'staff-1', user_id: 'user-1', full_name: '担当A' }])
      }
      if (table === 'notification_templates') {
        return createChainQuery([])
      }
      if (table === 'customers') {
        return createChainQuery(params.customers)
      }
      if (table === 'visits') {
        return createChainQuery(params.visits)
      }
      if (table === 'appointments') {
        return createChainQuery(params.appointments ?? [])
      }
      if (table === 'pets') {
        return createChainQuery(params.pets ?? [])
      }
      if (table === 'store_customer_management_settings') {
        return createChainQuery(params.settings)
      }
      return createChainQuery([])
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
    const supabase = createCandidateSupabaseMock({
      activeTaskRows: [
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
      ],
      customers: [
        { id: 'customer-blocked', full_name: 'クールダウン中 顧客', phone_number: null, line_id: null },
        { id: 'customer-released', full_name: '再候補 顧客', phone_number: null, line_id: null },
      ],
      visits: [
        { customer_id: 'customer-blocked', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null },
        { customer_id: 'customer-released', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null },
      ],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 30,
        followup_lost_refollow_days: 90,
      },
    })

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
    const supabase = createCandidateSupabaseMock({
      activeTaskRows: [],
      customers: [
        { id: 'customer-in-window', full_name: '直近候補 顧客', phone_number: null, line_id: null },
        { id: 'customer-out-window', full_name: '期間外候補 顧客', phone_number: null, line_id: null },
      ],
      visits: [
        // 45日後が 2026-04-05 となるため window_days=7 で対象内
        { customer_id: 'customer-in-window', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null },
        // 45日後が 2026-02-15 となるため window_days=7 では対象外
        { customer_id: 'customer-out-window', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null },
      ],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

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

  // TRACE-056
  it('excludes customers with future bookings from include_candidates results', async () => {
    const supabase = createCandidateSupabaseMock({
      activeTaskRows: [],
      customers: [
        { id: 'customer-future-booking', full_name: '未来予約あり 顧客', phone_number: null, line_id: null },
        { id: 'customer-no-future', full_name: '未来予約なし 顧客', phone_number: null, line_id: null },
      ],
      visits: [
        { customer_id: 'customer-future-booking', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null },
        { customer_id: 'customer-no-future', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null },
      ],
      appointments: [
        {
          id: 'appt-future-1',
          customer_id: 'customer-future-booking',
          pet_id: null,
          staff_id: null,
          start_time: '2026-04-20T00:00:00.000Z',
          status: '予約確定',
        },
      ],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

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
      candidates: Array<{ customer_id: string }>
    }
    const candidateIds = payload.candidates.map((row) => row.customer_id)
    expect(candidateIds).toContain('customer-no-future')
    expect(candidateIds).not.toContain('customer-future-booking')
  })

  // TRACE-057
  it('keeps candidate calculation invariant when include_candidates=true with status query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [
        { id: 'customer-a', full_name: '候補A', phone_number: null, line_id: null },
      ],
      visits: [
        { customer_id: 'customer-a', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null },
      ],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseAll = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseAll.status).toBe(200)
    const payloadAll = (await responseAll.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithStatus = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&status=in_progress')
    )
    expect(responseWithStatus.status).toBe(200)
    const payloadWithStatus = (await responseWithStatus.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithStatus.candidates.map((row) => row.customer_id)).toEqual(
      payloadAll.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-058
  it('keeps candidate calculation invariant when include_candidates=true with due query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-due-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-b', full_name: '候補B', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-b', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithDue = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&due=overdue')
    )
    expect(responseWithDue.status).toBe(200)
    const payloadWithDue = (await responseWithDue.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithDue.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-059
  it('keeps candidate calculation invariant when include_candidates=true with assignee query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-assignee-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-c', full_name: '候補C', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-c', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithAssignee = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&assignee=me')
    )
    expect(responseWithAssignee.status).toBe(200)
    const payloadWithAssignee = (await responseWithAssignee.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithAssignee.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-060
  it('applies window_days=30 boundary to candidates when include_candidates=true', async () => {
    const supabase = createCandidateSupabaseMock({
      activeTaskRows: [],
      customers: [
        { id: 'customer-in-7', full_name: '7日内候補 顧客', phone_number: null, line_id: null },
        { id: 'customer-in-30', full_name: '30日内候補 顧客', phone_number: null, line_id: null },
        { id: 'customer-out-30', full_name: '30日外候補 顧客', phone_number: null, line_id: null },
      ],
      visits: [
        // 45日後が 2026-04-05 となり window_days=7 / 30 の対象
        { customer_id: 'customer-in-7', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null },
        // 45日後が 2026-03-20 となり window_days=30 のみ対象
        { customer_id: 'customer-in-30', visit_date: '2026-02-03T00:00:00.000Z', appointment_id: null },
        // 45日後が 2026-02-15 となり window_days=30 の対象外
        { customer_id: 'customer-out-30', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null },
      ],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const response30 = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30')
    )
    expect(response30.status).toBe(200)
    const payload30 = (await response30.json()) as {
      candidates: Array<{ customer_id: string }>
    }
    const candidateIds30 = payload30.candidates.map((row) => row.customer_id)
    expect(candidateIds30).toContain('customer-in-7')
    expect(candidateIds30).toContain('customer-in-30')
    expect(candidateIds30).not.toContain('customer-out-30')
  })

  // TRACE-061
  it('keeps candidate calculation invariant when include_candidates=true with explicit assignee query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-explicit-assignee-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          assigned_user_id: 'user-2',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-d', full_name: '候補D', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-d', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithAssignee = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&assignee=user-2')
    )
    expect(responseWithAssignee.status).toBe(200)
    const payloadWithAssignee = (await responseWithAssignee.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithAssignee.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-062
  it('keeps candidate calculation invariant when include_candidates=true with assignee=unassigned', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-unassigned-1',
          customer_id: 'customer-task-only',
          status: 'open',
          assigned_user_id: null,
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-e', full_name: '候補E', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-e', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithUnassigned = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&assignee=unassigned')
    )
    expect(responseWithUnassigned.status).toBe(200)
    const payloadWithUnassigned = (await responseWithUnassigned.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithUnassigned.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-063
  it('keeps request safe and candidate calculation invariant when include_candidates=true with invalid status query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-invalid-status-1',
          customer_id: 'customer-task-only',
          status: 'open',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-f', full_name: '候補F', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-f', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithInvalidStatus = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&status=done')
    )
    expect(responseWithInvalidStatus.status).toBe(200)
    const payloadWithInvalidStatus = (await responseWithInvalidStatus.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithInvalidStatus.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-064
  it('keeps candidate calculation invariant when include_candidates=true with due=all query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-due-all-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-10',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-g', full_name: '候補G', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-g', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithDueAll = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&due=all')
    )
    expect(responseWithDueAll.status).toBe(200)
    const payloadWithDueAll = (await responseWithDueAll.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithDueAll.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-065
  it('keeps candidate calculation invariant when include_candidates=true with status+due+assignee queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-multi-query-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-h', full_name: '候補H', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-h', visit_date: '2026-01-10T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithMultiQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=in_progress&due=overdue&assignee=me'
      )
    )
    expect(responseWithMultiQuery.status).toBe(200)
    const payloadWithMultiQuery = (await responseWithMultiQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithMultiQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-066
  it('keeps candidate calculation invariant when include_candidates=true with window_days=30 and status query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window30-status-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          recommended_at: '2026-03-15T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-i', full_name: '候補I', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-i', visit_date: '2026-02-03T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithStatus = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=30&status=in_progress'
      )
    )
    expect(responseWithStatus.status).toBe(200)
    const payloadWithStatus = (await responseWithStatus.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithStatus.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-067
  it('keeps candidate calculation invariant when include_candidates=true with window_days=30 and assignee query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window30-assignee-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-15T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-j', full_name: '候補J', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-j', visit_date: '2026-02-03T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithAssignee = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30&assignee=me')
    )
    expect(responseWithAssignee.status).toBe(200)
    const payloadWithAssignee = (await responseWithAssignee.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithAssignee.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-068
  it('keeps candidate calculation invariant when include_candidates=true with window_days=30 and due query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window30-due-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          recommended_at: '2026-03-15T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-k', full_name: '候補K', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-k', visit_date: '2026-02-03T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithDue = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=30&due=overdue')
    )
    expect(responseWithDue.status).toBe(200)
    const payloadWithDue = (await responseWithDue.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithDue.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-069
  it('keeps candidate calculation invariant when include_candidates=true with window_days=7 and status query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window7-status-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          recommended_at: '2026-04-05T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-l', full_name: '候補L', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-l', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithStatus = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7&status=in_progress')
    )
    expect(responseWithStatus.status).toBe(200)
    const payloadWithStatus = (await responseWithStatus.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithStatus.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-070
  it('keeps candidate calculation invariant when include_candidates=true with window_days=7 and assignee query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window7-assignee-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          assigned_user_id: 'user-1',
          recommended_at: '2026-04-05T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-m', full_name: '候補M', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-m', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithAssignee = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7&assignee=me')
    )
    expect(responseWithAssignee.status).toBe(200)
    const payloadWithAssignee = (await responseWithAssignee.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithAssignee.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-071
  it('keeps candidate calculation invariant when include_candidates=true with window_days=7 and due query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-window7-due-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          recommended_at: '2026-04-05T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-n', full_name: '候補N', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-n', visit_date: '2026-02-19T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithDue = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=7&due=overdue')
    )
    expect(responseWithDue.status).toBe(200)
    const payloadWithDue = (await responseWithDue.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithDue.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-072
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status+due=all+assignee=unassigned queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-multi-unassigned-1',
          customer_id: 'customer-task-only',
          status: 'open',
          due_on: '2026-04-12',
          assigned_user_id: null,
          recommended_at: '2026-01-20T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-o', full_name: '候補O', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-o', visit_date: '2026-01-01T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithMultiQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=open&due=all&assignee=unassigned'
      )
    )
    expect(responseWithMultiQuery.status).toBe(200)
    const payloadWithMultiQuery = (await responseWithMultiQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithMultiQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-073
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and invalid status + due + assignee queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-invalid-status-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          assigned_user_id: 'user-2',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-p', full_name: '候補P', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-p', visit_date: '2026-01-05T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithMixedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=done&due=overdue&assignee=user-2'
      )
    )
    expect(responseWithMixedQuery.status).toBe(200)
    const payloadWithMixedQuery = (await responseWithMixedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithMixedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-074
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and due=today query', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-due-today-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-10',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-01T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-q', full_name: '候補Q', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-q', visit_date: '2026-01-08T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithDueToday = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all&due=today')
    )
    expect(responseWithDueToday.status).toBe(200)
    const payloadWithDueToday = (await responseWithDueToday.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithDueToday.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-075
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status+due=today+assignee=me queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-status-due-today-me-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-10',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-12T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-r', full_name: '候補R', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-r', visit_date: '2026-01-09T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=in_progress&due=today&assignee=me'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-076
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and due=overdue+assignee=user-2 queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-due-overdue-user2-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-09',
          assigned_user_id: 'user-2',
          recommended_at: '2026-03-10T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-s', full_name: '候補S', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-s', visit_date: '2026-01-11T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&due=overdue&assignee=user-2'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-077
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status=open+due=today+assignee=user-2 queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-open-due-today-user2-1',
          customer_id: 'customer-task-only',
          status: 'open',
          due_on: '2026-04-10',
          assigned_user_id: 'user-2',
          recommended_at: '2026-03-11T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-t', full_name: '候補T', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-t', visit_date: '2026-01-12T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=open&due=today&assignee=user-2'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-078
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status=snoozed+assignee=unassigned queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-snoozed-unassigned-1',
          customer_id: 'customer-task-only',
          status: 'snoozed',
          assigned_user_id: null,
          snoozed_until: '2026-04-20',
          recommended_at: '2026-03-14T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-u', full_name: '候補U', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-u', visit_date: '2026-01-13T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=snoozed&assignee=unassigned'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-079
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status=in_progress+due=all+assignee=user-2 queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-inprogress-dueall-user2-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-11',
          assigned_user_id: 'user-2',
          recommended_at: '2026-03-13T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-v', full_name: '候補V', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-v', visit_date: '2026-01-14T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=in_progress&due=all&assignee=user-2'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-080
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status=resolved_no_need+due=overdue+assignee=me queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-resolved-noneed-overdue-me-1',
          customer_id: 'customer-task-only',
          status: 'resolved_no_need',
          due_on: '2026-04-09',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-15T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-w', full_name: '候補W', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-w', visit_date: '2026-01-15T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=resolved_no_need&due=overdue&assignee=me'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-081
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and due=today+assignee=unassigned queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-due-today-unassigned-1',
          customer_id: 'customer-task-only',
          status: 'open',
          due_on: '2026-04-10',
          assigned_user_id: null,
          recommended_at: '2026-03-16T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-x', full_name: '候補X', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-x', visit_date: '2026-01-16T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&due=today&assignee=unassigned'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-082
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and invalid due+assignee=me queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-invalid-due-me-1',
          customer_id: 'customer-task-only',
          status: 'in_progress',
          due_on: '2026-04-10',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-17T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-y', full_name: '候補Y', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-y', visit_date: '2026-01-17T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&due=invalid&assignee=me'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-083
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and due=all+assignee=user-999 queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-dueall-user999-1',
          customer_id: 'customer-task-only',
          status: 'open',
          due_on: '2026-04-12',
          assigned_user_id: 'user-999',
          recommended_at: '2026-03-18T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-z', full_name: '候補Z', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-z', visit_date: '2026-01-18T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&due=all&assignee=user-999'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-084
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and status=resolved_lost+due=all+assignee=me queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-resolved-lost-all-me-1',
          customer_id: 'customer-task-only',
          status: 'resolved_lost',
          due_on: '2026-04-12',
          assigned_user_id: 'user-1',
          recommended_at: '2026-03-19T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-aa', full_name: '候補AA', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-aa', visit_date: '2026-01-19T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=resolved_lost&due=all&assignee=me'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })

  // TRACE-085
  it('keeps candidate calculation invariant when include_candidates=true with window_days=all and invalid status+due=today+assignee=unassigned queries', async () => {
    const supabase = createCandidateSupabaseMock({
      taskRows: [
        {
          id: 'task-windowall-invalid-status-today-unassigned-1',
          customer_id: 'customer-task-only',
          status: 'open',
          due_on: '2026-04-10',
          assigned_user_id: null,
          recommended_at: '2026-03-20T00:00:00.000Z',
          customers: { full_name: 'タスク顧客' },
          pets: null,
        },
      ],
      activeTaskRows: [],
      customers: [{ id: 'customer-ab', full_name: '候補AB', phone_number: null, line_id: null }],
      visits: [{ customer_id: 'customer-ab', visit_date: '2026-01-20T00:00:00.000Z', appointment_id: null }],
      settings: {
        followup_snoozed_refollow_days: 7,
        followup_no_need_refollow_days: 60,
        followup_lost_refollow_days: 90,
      },
    })

    getFollowupRouteContextMock.mockResolvedValue({
      supabase,
      storeId: 'store-1',
      user: { id: 'user-1' },
      role: 'owner',
    })

    const { GET } = await import('../src/app/api/followups/route')

    const responseBase = await GET(
      new Request('http://localhost/api/followups?include_candidates=true&window_days=all')
    )
    expect(responseBase.status).toBe(200)
    const payloadBase = (await responseBase.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    const responseWithCombinedQuery = await GET(
      new Request(
        'http://localhost/api/followups?include_candidates=true&window_days=all&status=done&due=today&assignee=unassigned'
      )
    )
    expect(responseWithCombinedQuery.status).toBe(200)
    const payloadWithCombinedQuery = (await responseWithCombinedQuery.json()) as {
      candidates: Array<{ customer_id: string }>
    }

    expect(payloadWithCombinedQuery.candidates.map((row) => row.customer_id)).toEqual(
      payloadBase.candidates.map((row) => row.customer_id)
    )
  })
})
