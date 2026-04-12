import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, validateConsentDocumentCreateInputMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  validateConsentDocumentCreateInputMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/consents/documents-core', async () => {
  const actual = await vi.importActual<typeof import('@/lib/consents/documents-core')>('@/lib/consents/documents-core')
  return {
    ...actual,
    validateConsentDocumentCreateInput: validateConsentDocumentCreateInputMock,
  }
})

function createConsentsSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(_table: string) {
      return {
        select() {
          return {
            eq() {
              return this
            },
            order() {
              return this
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }
        },
      }
    },
  }
}

function createConsentPdfPendingSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    storage: {
      from() {
        return {
          createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
        }
      },
    },
    from(table: string) {
      if (table === 'consent_documents') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: { id: 'doc-1', pdf_path: null, status: 'sent' },
                error: null,
              }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function createConsentDocumentNotFoundSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'consent_documents') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: null, error: null }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function createConsentRevokedSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'consent_documents') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({
                data: { id: 'doc-1', status: 'revoked', revoked_at: '2026-04-12T00:00:00.000Z' },
                error: null,
              }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('consents routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createConsentsSupabaseMock(),
      storeId: 'store-1',
    })
  })

  // TRACE-139
  it('POST /api/consents/templates returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/consents/templates/route')
    const response = await POST(
      new Request('http://localhost/api/consents/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'invalid json body.' })
  })

  // TRACE-140
  it('POST /api/consents/templates returns 400 when name is missing', async () => {
    const { POST } = await import('../src/app/api/consents/templates/route')
    const response = await POST(
      new Request('http://localhost/api/consents/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'grooming' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'name is required.' })
  })

  // TRACE-141
  it('POST /api/consents/documents returns 400 when validation fails', async () => {
    validateConsentDocumentCreateInputMock.mockReturnValue({
      ok: false,
      message: 'customer_id is required.',
    })
    const { POST } = await import('../src/app/api/consents/documents/route')
    const response = await POST(
      new Request('http://localhost/api/consents/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'customer_id is required.' })
  })

  // TRACE-259
  it('GET /api/consents/documents/[document_id]/pdf returns 409 when pdf is not generated', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createConsentPdfPendingSupabaseMock(),
      storeId: 'store-1',
    })
    const { GET } = await import('../src/app/api/consents/documents/[document_id]/pdf/route')
    const response = await GET(
      new Request('http://localhost/api/consents/documents/doc-1/pdf'),
      { params: Promise.resolve({ document_id: 'doc-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ message: 'pdf not generated yet.' })
  })

  // TRACE-356
  it('POST /api/consents/documents/[document_id]/resend returns 404 when document is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createConsentDocumentNotFoundSupabaseMock(),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/consents/documents/[document_id]/resend/route')
    const response = await POST(
      new Request('http://localhost/api/consents/documents/doc-404/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'email' }),
      }),
      { params: Promise.resolve({ document_id: 'doc-404' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'document not found.' })
  })

  // TRACE-357
  it('POST /api/consents/documents/[document_id]/revoke returns reused response for already revoked document', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createConsentRevokedSupabaseMock(),
      storeId: 'store-1',
    })
    const { POST } = await import('../src/app/api/consents/documents/[document_id]/revoke/route')
    const response = await POST(
      new Request('http://localhost/api/consents/documents/doc-1/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'manual' }),
      }),
      { params: Promise.resolve({ document_id: 'doc-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, reused: true })
  })

  // TRACE-358
  it('POST /api/consents/templates/[template_id]/versions returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../src/app/api/consents/templates/[template_id]/versions/route')
    const response = await POST(
      new Request('http://localhost/api/consents/templates/template-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: Promise.resolve({ template_id: 'template-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'invalid json body.' })
  })
})
