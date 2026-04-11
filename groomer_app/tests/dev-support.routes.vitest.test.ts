import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireDeveloperAdminMock, createAdminSupabaseClientMock } = vi.hoisted(() => ({
  requireDeveloperAdminMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
}))

vi.mock('@/lib/auth/developer-admin', () => ({
  requireDeveloperAdmin: requireDeveloperAdminMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

describe('dev support routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireDeveloperAdminMock.mockResolvedValue({
      ok: true,
      user: { id: 'dev-1' },
    })
    createAdminSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: 'store-1' }, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'ticket-1' }, error: null })),
              })),
            })),
          })),
        })),
      })),
    })
  })

  // TRACE-276
  it('GET /api/dev/support-chat/messages returns 400 when store_id is missing', async () => {
    const { GET } = await import('../src/app/api/dev/support-chat/messages/route')
    const response = await GET(new Request('http://localhost/api/dev/support-chat/messages'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'store_id は必須です。' })
  })

  // TRACE-277
  it('PATCH /api/dev/support-tickets returns 400 when payload has no updates', async () => {
    const { PATCH } = await import('../src/app/api/dev/support-tickets/route')
    const response = await PATCH(
      new Request('http://localhost/api/dev/support-tickets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: 'store-1', ticket_id: 'ticket-1' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '更新内容がありません。' })
  })
})
