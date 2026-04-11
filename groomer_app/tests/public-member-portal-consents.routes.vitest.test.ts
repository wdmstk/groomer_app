import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createAdminSupabaseClientMock,
  hashConsentTokenMock,
  noStoreHeadersMock,
  getMemberPortalPayloadMock,
  MemberPortalServiceErrorMock,
  getMemberPortalReservationPrefillMock,
  isValidMemberPortalTokenFormatMock,
  normalizeMemberPortalWaitlistInputMock,
  validateMemberPortalWaitlistInputMock,
  pickClientIpFromHeadersMock,
  toPrivacyHashMock,
} = vi.hoisted(() => {
  class MockMemberPortalServiceError extends Error {
    status: number

    constructor(message: string, status = 500) {
      super(message)
      this.status = status
    }
  }

  return {
    createAdminSupabaseClientMock: vi.fn(),
    hashConsentTokenMock: vi.fn(),
    noStoreHeadersMock: vi.fn(),
    getMemberPortalPayloadMock: vi.fn(),
    MemberPortalServiceErrorMock: MockMemberPortalServiceError,
    getMemberPortalReservationPrefillMock: vi.fn(),
    isValidMemberPortalTokenFormatMock: vi.fn(),
    normalizeMemberPortalWaitlistInputMock: vi.fn(),
    validateMemberPortalWaitlistInputMock: vi.fn(),
    pickClientIpFromHeadersMock: vi.fn(),
    toPrivacyHashMock: vi.fn(),
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/consents/shared', () => ({
  hashConsentToken: hashConsentTokenMock,
  noStoreHeaders: noStoreHeadersMock,
}))

vi.mock('@/lib/member-portal', () => ({
  getMemberPortalPayload: getMemberPortalPayloadMock,
  getMemberPortalReservationPrefill: getMemberPortalReservationPrefillMock,
  MemberPortalServiceError: MemberPortalServiceErrorMock,
  hashMemberPortalToken: vi.fn(() => 'hashed-token'),
  isValidMemberPortalTokenFormat: isValidMemberPortalTokenFormatMock,
}))

vi.mock('@/lib/member-portal-waitlist', () => ({
  normalizeMemberPortalWaitlistInput: normalizeMemberPortalWaitlistInputMock,
  validateMemberPortalWaitlistInput: validateMemberPortalWaitlistInputMock,
}))

vi.mock('@/lib/privacy-hash', () => ({
  pickClientIpFromHeaders: pickClientIpFromHeadersMock,
  toPrivacyHash: toPrivacyHashMock,
}))

function createAdminWithSingleTable(tableName: string, payload: unknown) {
  return {
    from(table: string) {
      if (table === tableName) {
        return payload
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('public member-portal and consents routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    hashConsentTokenMock.mockReturnValue('token-hash')
    noStoreHeadersMock.mockReturnValue({ 'Cache-Control': 'no-store' })
    pickClientIpFromHeadersMock.mockReturnValue('127.0.0.1')
    toPrivacyHashMock.mockImplementation((value: string | null) => (value ? `hash:${value}` : null))
    isValidMemberPortalTokenFormatMock.mockReturnValue(true)
  })

  // TRACE-230
  it('GET /api/public/consents/[token] returns 404 when document is not found', async () => {
    createAdminSupabaseClientMock.mockReturnValue(
      createAdminWithSingleTable('consent_documents', {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }
        },
      })
    )

    const { GET } = await import('../src/app/api/public/consents/[token]/route')
    const response = await GET(new Request('http://localhost/api/public/consents/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'document not found.' })
  })

  // TRACE-231
  it('GET /api/public/consents/[token]/sign returns 405', async () => {
    const { GET } = await import('../src/app/api/public/consents/[token]/sign/route')
    const response = await GET()

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({
      message: 'Method Not Allowed. Use POST /api/public/consents/[token]/sign',
    })
  })

  // TRACE-232
  it('GET /api/public/member-portal/[token] maps MemberPortalServiceError status', async () => {
    getMemberPortalPayloadMock.mockRejectedValueOnce(
      new MemberPortalServiceErrorMock('token expired', 410)
    )

    const { GET } = await import('../src/app/api/public/member-portal/[token]/route')
    const response = await GET(new Request('http://localhost/api/public/member-portal/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    })

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({ message: 'token expired' })
  })

  // TRACE-233
  it('GET /api/public/member-portal/[token]/prefill returns mapped payload', async () => {
    getMemberPortalReservationPrefillMock.mockResolvedValueOnce({
      store: { id: 'store-1', name: '店舗A' },
      customer: { id: 'customer-1', full_name: '山田太郎' },
      pet: { id: 'pet-1', name: 'ポチ' },
      recommendedMenuIds: ['menu-1'],
      pets: [{ id: 'pet-1', name: 'ポチ' }],
    })

    const { GET } = await import('../src/app/api/public/member-portal/[token]/prefill/route')
    const response = await GET(
      new Request('http://localhost/api/public/member-portal/token-1/prefill'),
      {
        params: Promise.resolve({ token: 'token-1' }),
      }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      store: { id: 'store-1' },
      customer: { id: 'customer-1' },
      pet: { id: 'pet-1' },
      recommendedMenuIds: ['menu-1'],
    })
  })

  // TRACE-234
  it('POST /api/public/member-portal/[token]/reissue-request returns 400 for invalid token format', async () => {
    isValidMemberPortalTokenFormatMock.mockReturnValueOnce(false)

    const { POST } = await import('../src/app/api/public/member-portal/[token]/reissue-request/route')
    const response = await POST(
      new Request('http://localhost/api/public/member-portal/bad/reissue-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'お願いします' }),
      }),
      { params: Promise.resolve({ token: 'bad' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '会員証URLが不正です。' })
  })

  // TRACE-235
  it('POST /api/public/member-portal/[token]/waitlist returns 400 for validation error', async () => {
    getMemberPortalPayloadMock.mockResolvedValueOnce({
      store: { id: 'store-1' },
      customer: { id: 'customer-1' },
    })
    normalizeMemberPortalWaitlistInputMock.mockReturnValueOnce({
      pet_id: null,
      preferred_menu: null,
      preferred_staff_id: null,
      channel: 'line',
      desired_from: null,
      desired_to: null,
      notes: null,
    })
    validateMemberPortalWaitlistInputMock.mockReturnValueOnce('希望条件を入力してください。')

    createAdminSupabaseClientMock.mockReturnValue(
      createAdminWithSingleTable('customers', {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: { line_id: 'line-1', phone_number: null }, error: null }),
          }
        },
      })
    )

    const { POST } = await import('../src/app/api/public/member-portal/[token]/waitlist/route')
    const response = await POST(
      new Request('http://localhost/api/public/member-portal/token-1/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ token: 'token-1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '希望条件を入力してください。' })
  })
})
