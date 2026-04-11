import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createRouteHandlerClientMock } = vi.hoisted(() => ({
  createRouteHandlerClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: createRouteHandlerClientMock,
}))

describe('auth routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  // TRACE-157
  it('POST /api/auth/login redirects to dashboard on successful login', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null })
    createRouteHandlerClientMock.mockResolvedValue({
      auth: { signInWithPassword },
    })

    const { POST } = await import('../src/app/api/auth/login/route')
    const form = new FormData()
    form.set('email', 'owner@example.com')
    form.set('password', 'pass1234')

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: form,
      })
    )

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'pass1234',
    })
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('http://localhost/dashboard')
  })

  // TRACE-158
  it('POST /api/auth/login redirects back to login with error when auth fails', async () => {
    createRouteHandlerClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } }),
      },
    })

    const { POST } = await import('../src/app/api/auth/login/route')
    const form = new FormData()
    form.set('email', 'owner@example.com')
    form.set('password', 'wrong')

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(301)
    const location = decodeURIComponent(response.headers.get('location') ?? '')
    expect(location).toContain('/login?error=Invalid login credentials')
  })

  // TRACE-159
  it('POST /api/auth/logout signs out and redirects to login', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    createRouteHandlerClientMock.mockResolvedValue({
      auth: { signOut },
    })

    const { POST } = await import('../src/app/api/auth/logout/route')
    const response = await POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }))

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })
})
