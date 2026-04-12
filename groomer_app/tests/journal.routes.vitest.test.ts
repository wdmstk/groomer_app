import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireJournalStoreContextMock,
  requireJournalPermissionMock,
  enqueueJournalLineNotificationMock,
} = vi.hoisted(() => ({
  requireJournalStoreContextMock: vi.fn(),
  requireJournalPermissionMock: vi.fn(),
  enqueueJournalLineNotificationMock: vi.fn(),
}))

vi.mock('@/lib/journal/api-guard', () => ({
  requireJournalStoreContext: requireJournalStoreContextMock,
}))

vi.mock('@/lib/journal/permissions', () => ({
  requireJournalPermission: requireJournalPermissionMock,
}))

vi.mock('@/lib/journal/notifications', () => ({
  enqueueJournalLineNotification: enqueueJournalLineNotificationMock,
}))

function thenableResult(data: unknown, error: { message: string } | null = null) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    order() {
      return this
    },
    in() {
      return this
    },
    limit() {
      return this
    },
    maybeSingle: async () => ({ data, error }),
    then(resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) {
      return Promise.resolve(resolve({ data, error }))
    },
  }
}

describe('journal routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    requireJournalStoreContextMock.mockResolvedValue({
      ok: true,
      storeId: 'store-1',
      staffId: 'staff-1',
      permissions: {
        canCreate: true,
        canPublish: true,
        canViewInternal: true,
      },
      supabase: {
        from(table: string) {
          if (table === 'journal_entries') {
            return {
              update() {
                return this
              },
              eq() {
                return this
              },
              select() {
                return this
              },
              maybeSingle: async () => ({
                data: { id: 'entry-1', customer_id: 'customer-1', status: 'draft', updated_at: '2026-04-12T00:00:00.000Z', posted_at: null },
                error: null,
              }),
              insert() {
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: { id: 'entry-1', status: 'draft', posted_at: null, created_at: '2026-04-12T00:00:00.000Z', updated_at: '2026-04-12T00:00:00.000Z' },
                        error: null,
                      }),
                    }
                  },
                }
              },
            }
          }
          if (table === 'journal_media' || table === 'journal_health_checks' || table === 'journal_links') {
            return {
              delete() {
                return this
              },
              eq() {
                return this
              },
              insert: async () => ({ error: null }),
            }
          }
          if (table === 'journal_entry_pets') {
            return thenableResult([{ entry_id: 'entry-1' }], null)
          }
          return thenableResult([], null)
        },
      },
    })

    requireJournalPermissionMock.mockImplementation((permissions: Record<string, boolean>, key: string) => {
      if (permissions?.[key]) return { ok: true }
      return { ok: false, status: 403, message: 'forbidden' }
    })

    enqueueJournalLineNotificationMock.mockResolvedValue({ queued: true, reason: 'queued' })
  })

  // TRACE-272
  it('POST /api/journal/entries returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/journal/entries/route')
    const response = await POST(
      new Request('http://localhost/api/journal/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid JSON body.' })
  })

  // TRACE-273
  it('POST /api/journal/entries returns 403 when publish requested without canPublish', async () => {
    requireJournalStoreContextMock.mockResolvedValueOnce({
      ok: true,
      storeId: 'store-1',
      staffId: 'staff-1',
      permissions: {
        canCreate: true,
        canPublish: false,
        canViewInternal: true,
      },
      supabase: {
        from() {
          return thenableResult([], null)
        },
      },
    })

    const { POST } = await import('../src/app/api/journal/entries/route')
    const response = await POST(
      new Request('http://localhost/api/journal/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer_id: 'customer-1', pet_ids: ['pet-1'], publish: true }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: 'forbidden' })
  })

  // TRACE-274
  it('PATCH /api/journal/entries/[entry_id] returns 400 for invalid visibility', async () => {
    const { PATCH } = await import('../src/app/api/journal/entries/[entry_id]/route')
    const response = await PATCH(
      new Request('http://localhost/api/journal/entries/entry-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibility: 'public' }),
      }),
      { params: Promise.resolve({ entry_id: 'entry-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'visibility must be owner or internal.' })
  })

  // TRACE-275
  it('GET /api/journal/pets/[pet_id]/timeline returns 500 when mapping query fails', async () => {
    requireJournalStoreContextMock.mockResolvedValueOnce({
      ok: true,
      storeId: 'store-1',
      permissions: { canViewInternal: true },
      supabase: {
        from(table: string) {
          if (table === 'journal_entry_pets') {
            return thenableResult(null, { message: 'mapping failed' })
          }
          throw new Error(`Unexpected table: ${table}`)
        },
      },
    })

    const { GET } = await import('../src/app/api/journal/pets/[pet_id]/timeline/route')
    const response = await GET(new Request('http://localhost/api/journal/pets/pet-1/timeline'), {
      params: Promise.resolve({ pet_id: 'pet-1' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'mapping failed' })
  })

  // TRACE-385
  it('POST /api/journal/entries/[entry_id]/notify returns 400 when recipient cannot be resolved', async () => {
    requireJournalStoreContextMock.mockResolvedValueOnce({
      ok: true,
      storeId: 'store-1',
      staffId: 'staff-1',
      permissions: {
        canCreate: true,
        canPublish: true,
        canViewInternal: true,
      },
      supabase: {
        from(table: string) {
          if (table === 'journal_entries') {
            return {
              select() {
                return {
                  eq() {
                    return this
                  },
                  maybeSingle: async () => ({ data: { id: 'entry-1', customer_id: null, status: 'draft' }, error: null }),
                }
              },
            }
          }
          throw new Error(`Unexpected table: ${table}`)
        },
      },
    })

    const { POST } = await import('../src/app/api/journal/entries/[entry_id]/notify/route')
    const response = await POST(
      new Request('http://localhost/api/journal/entries/entry-1/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'line' }),
      }),
      { params: Promise.resolve({ entry_id: 'entry-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'recipient_customer_id is required.' })
  })
})
