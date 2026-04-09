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

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/followups/task-1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createSupabaseMock(options?: { memberExists?: boolean }) {
  return {
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: options?.memberExists ? { user_id: 'user-2' } : null,
                error: null,
              }),
            }
          },
        }
      }
      return {
        update() {
          return {
            eq() {
              return this
            },
            select() {
              return {
                single: async () => ({
                  data: { id: 'task-1', status: 'open' },
                  error: null,
                }),
              }
            },
          }
        },
        insert: async () => ({ error: null }),
      }
    },
  }
}

describe('followups status route', () => {
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
        status: 'open',
        snoozed_until: null,
        resolved_at: null,
        resolution_type: null,
        resolution_note: null,
        assigned_user_id: null,
      },
    })
  })

  // TRACE-004
  it('returns 400 when status is invalid', async () => {
    const { PATCH } = await import('../src/app/api/followups/[followup_id]/status/route')
    const response = await PATCH(buildRequest({ status: 'bad_status' }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '有効な status を指定してください。',
    })
  })

  // TRACE-005
  it('returns 400 when snoozed transition does not include snoozed_until', async () => {
    const { PATCH } = await import('../src/app/api/followups/[followup_id]/status/route')
    const response = await PATCH(buildRequest({ status: 'snoozed' }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: 'snoozed status では snoozed_until が必須です。',
    })
  })

  it('returns 400 when resolved transition does not include resolution_type', async () => {
    const { PATCH } = await import('../src/app/api/followups/[followup_id]/status/route')
    const response = await PATCH(buildRequest({ status: 'resolved_no_need' }), {
      params: Promise.resolve({ followup_id: 'task-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '解決系 status では resolution_type が必須です。',
    })
  })

  it('returns 400 when assigned_user_id is not an active store member', async () => {
    getFollowupRouteContextMock.mockResolvedValue({
      supabase: createSupabaseMock({ memberExists: false }),
      storeId: 'store-1',
      user: { id: 'user-1' },
    })
    const { PATCH } = await import('../src/app/api/followups/[followup_id]/status/route')
    const response = await PATCH(
      buildRequest({
        assigned_user_id: 'user-2',
        resolution_note: '担当差し替え',
      }),
      {
        params: Promise.resolve({ followup_id: 'task-1' }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: '指定された担当者は店舗メンバーではありません。',
    })
  })
})
