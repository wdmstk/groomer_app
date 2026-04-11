import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireStoreSupportTicketAccessMock, requireStoreSupportChatAccessMock } = vi.hoisted(() => ({
  requireStoreSupportTicketAccessMock: vi.fn(),
  requireStoreSupportChatAccessMock: vi.fn(),
}))

vi.mock('@/lib/auth/store-support-ticket', () => ({
  requireStoreSupportTicketAccess: requireStoreSupportTicketAccessMock,
}))

vi.mock('@/lib/auth/store-support-chat', () => ({
  requireStoreSupportChatAccess: requireStoreSupportChatAccessMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}))

describe('support routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireStoreSupportTicketAccessMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      role: 'owner',
      user: { id: 'user-1' },
    })
    requireStoreSupportChatAccessMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      role: 'owner',
      user: { id: 'user-1' },
    })
  })

  // TRACE-151
  it('POST /api/support-tickets returns 400 when subject is missing', async () => {
    const { POST } = await import('../src/app/api/support-tickets/route')
    const response = await POST(
      new Request('http://localhost/api/support-tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: 'detail only' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '件名は必須です。' })
  })

  // TRACE-152
  it('PATCH /api/support-tickets returns 400 when ticket_id is missing', async () => {
    const { PATCH } = await import('../src/app/api/support-tickets/route')
    const response = await PATCH(
      new Request('http://localhost/api/support-tickets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment: 'hello' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'ticket_id は必須です。' })
  })

  // TRACE-153
  it('POST /api/support-chat/messages returns 400 when message is empty', async () => {
    const { POST } = await import('../src/app/api/support-chat/messages/route')
    const response = await POST(
      new Request('http://localhost/api/support-chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '   ' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'メッセージは必須です。' })
  })
})
