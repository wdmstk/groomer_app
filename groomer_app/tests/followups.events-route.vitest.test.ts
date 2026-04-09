import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getFollowupRouteContextMock, assertFollowupTaskInStoreMock } = vi.hoisted(() => ({
  getFollowupRouteContextMock: vi.fn(),
  assertFollowupTaskInStoreMock: vi.fn(),
}))

vi.mock('@/lib/followups/shared', async () => {
  const actual = await vi.importActual<typeof import('@/lib/followups/shared')>('@/lib/followups/shared')
  return {
    ...actual,
    getFollowupRouteContext: getFollowupRouteContextMock,
    assertFollowupTaskInStore: assertFollowupTaskInStoreMock,
  }
})

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/followups/task-1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createSupabaseMock() {
  return {
    from(table: string) {
      if (table === 'customers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: { id: 'customer-1', phone_number: '090-1111-1111', line_id: 'line-111' },
                error: null,
              }),
            }
          },
        }
      }
      if (table === 'customer_notification_logs') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: null, error: null }),
            }
          },
          insert: async () => ({ error: null }),
        }
      }
      if (table === 'customer_followup_tasks') {
        return {
          update() {
            return {
              eq() {
                return this
              },
            }
          },
        }
      }
      if (table === 'customer_followup_events') {
        return {
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'event-1',
                      event_type: 'contacted_phone',
                      payload: {},
                      created_at: '2026-04-09T00:00:00.000Z',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }
      return {}
    },
  }
}

describe('followups events route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock(),
      storeId: 'store-1',
      user: { id: 'user-1' },
    })
    assertFollowupTaskInStoreMock.mockResolvedValue({
      data: {
        id: 'task-1',
        customer_id: 'customer-1',
        status: 'open',
      },
    })
  })

  // TRACE-006
  it('returns 400 when event_type is invalid', async () => {
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(buildRequest({ event_type: 'bad_event' }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '有効な event_type を指定してください。',
    })
  })

  // TRACE-007
  it('returns 400 when adding contacted_line to resolved task', async () => {
    assertFollowupTaskInStoreMock.mockResolvedValue({
      data: {
        id: 'task-1',
        customer_id: 'customer-1',
        status: 'resolved_no_need',
      },
    })
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(
      buildRequest({
        event_type: 'contacted_line',
        payload: { body: '再来店のご案内です。' },
      }),
      {
        params: Promise.resolve({ followup_id: 'task-1' }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '解決済みタスクには連絡記録を追加できません。',
    })
  })

  // TRACE-025
  it('allows note_added event for resolved task', async () => {
    assertFollowupTaskInStoreMock.mockResolvedValue({
      data: {
        id: 'task-1',
        customer_id: 'customer-1',
        status: 'resolved_lost',
      },
    })
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(
      buildRequest({
        event_type: 'note_added',
        payload: { note: '次回見込みは低い' },
      }),
      {
        params: Promise.resolve({ followup_id: 'task-1' }),
      }
    )

    expect(response.status).toBe(201)
  })

  // TRACE-027
  it('returns 400 when contacted_phone is requested but phone number is not registered', async () => {
    const supabase = createSupabaseMock()
    const fromSpy = vi.spyOn(supabase, 'from')
    fromSpy.mockImplementation((table: string) => {
      if (table !== 'customers') return createSupabaseMock().from(table)
      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({
              data: { id: 'customer-1', phone_number: null, line_id: 'line-111' },
              error: null,
            }),
          }
        },
      }
    })
    getFollowupRouteContextMock.mockResolvedValue({ supabase, storeId: 'store-1', user: { id: 'user-1' } })
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(buildRequest({ event_type: 'contacted_phone', payload: {} }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '電話番号が未登録です。',
    })
  })

  // TRACE-023
  it('returns 400 when contacted_phone payload has invalid result', async () => {
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(
      buildRequest({
        event_type: 'contacted_phone',
        payload: { result: 'invalid_result' },
      }),
      { params: Promise.resolve({ followup_id: 'task-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '電話連絡の result は connected/voicemail/no_answer のみ指定できます。',
    })
  })

  // TRACE-024
  it('returns 409 when same-day same-channel followup notification already exists', async () => {
    const supabase = createSupabaseMock()
    const fromSpy = vi.spyOn(supabase, 'from')
    fromSpy.mockImplementation((table: string) => {
      if (table !== 'customer_notification_logs') return createSupabaseMock().from(table)
      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: { id: 'dup-log-1' }, error: null }),
          }
        },
        insert: async () => ({ error: null }),
      }
    })
    getFollowupRouteContextMock.mockResolvedValue({ supabase, storeId: 'store-1', user: { id: 'user-1' } })
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(buildRequest({ event_type: 'contacted_phone', payload: { result: 'connected' } }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(409)
  })

  it('returns 400 when contacted_line payload has no body', async () => {
    const { POST } = await import('../src/app/api/followups/[followup_id]/events/route')
    const response = await POST(
      buildRequest({
        event_type: 'contacted_line',
        payload: { notification_type: 'followup' },
      }),
      {
        params: Promise.resolve({ followup_id: 'task-1' }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: 'LINE連絡記録では payload.body が必須です。',
    })
  })
})
