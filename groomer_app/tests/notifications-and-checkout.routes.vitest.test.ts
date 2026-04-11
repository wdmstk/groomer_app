import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, sendEmailMock, sendLineMessageMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  sendEmailMock: vi.fn(),
  sendLineMessageMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/resend', () => ({
  sendEmail: sendEmailMock,
}))

vi.mock('@/lib/line', () => ({
  sendLineMessage: sendLineMessageMock,
}))

function createNotificationTemplateSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'notification_templates') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              in: async () => ({ data: [], error: null }),
            }
          },
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  template_key: 'reminder_line',
                  channel: 'line',
                  subject: '前日リマインド',
                  body: 'body',
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'stores') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: { name: 'テスト店舗' }, error: null }),
            }
          },
        }
      }

      if (table === 'customer_notification_logs') {
        return {
          insert: async () => ({ error: null }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('notification and checkout routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    sendEmailMock.mockResolvedValue({ success: true })
    sendLineMessageMock.mockResolvedValue({ success: true })
    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: createNotificationTemplateSupabaseMock(),
    })
  })

  // TRACE-214
  it('GET /api/notification-templates with scope=notifications excludes hotel template key', async () => {
    const { GET } = await import('../src/app/api/notification-templates/route')
    const response = await GET(
      new Request('http://localhost/api/notification-templates?scope=notifications')
    )
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(Object.keys(payload.templates)).toContain('followup_line')
    expect(Object.keys(payload.templates)).not.toContain('hotel_stay_report_line')
  })

  // TRACE-215
  it('PATCH /api/notification-templates returns 400 when required fields are missing', async () => {
    const { PATCH } = await import('../src/app/api/notification-templates/route')
    const response = await PATCH(
      new Request('http://localhost/api/notification-templates', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template_key: 'reminder_line', channel: 'line', body: '   ' }),
      })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'template_key, channel, body は必須です。',
    })
  })

  // TRACE-216
  it('POST /api/notification-templates/test-send returns 400 when target is missing', async () => {
    const { POST } = await import('../src/app/api/notification-templates/test-send/route')
    const response = await POST(
      new Request('http://localhost/api/notification-templates/test-send', {
        method: 'POST',
        body: JSON.stringify({
          template_key: 'reminder_line',
          channel: 'line',
          target: '',
        }),
      })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'template_key, channel, target は必須です。',
    })
  })

  // TRACE-217
  it('POST /api/notify/email returns 400 for missing required fields', async () => {
    const { POST } = await import('../src/app/api/notify/email/route')
    const response = await POST(
      new Request('http://localhost/api/notify/email', {
        method: 'POST',
        body: JSON.stringify({ to: '', subject: 's', html: '' }),
      })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required fields (to, subject, html)',
    })
  })

  // TRACE-218
  it('POST /api/notify/line returns 400 for missing required fields', async () => {
    const { POST } = await import('../src/app/api/notify/line/route')
    const response = await POST(
      new Request('http://localhost/api/notify/line', {
        method: 'POST',
        body: JSON.stringify({ to: '', message: null }),
      })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required fields (to, message)',
    })
  })

  // TRACE-219
  it('POST /api/payments/checkout returns 401 when user is unauthenticated', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      storeId: 'store-1',
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: 'unauthorized' } }),
        },
      },
    })

    const { POST } = await import('../src/app/api/payments/checkout/route')
    const response = await POST(
      new Request('http://localhost/api/payments/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appointment_id: 'appt-1' }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })
})
