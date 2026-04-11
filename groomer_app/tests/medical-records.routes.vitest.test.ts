import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, normalizeCreateMedicalRecordInputMock, createMedicalRecordMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  normalizeCreateMedicalRecordInputMock: vi.fn(),
  createMedicalRecordMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/medical-records/services/create', () => ({
  normalizeCreateMedicalRecordInput: normalizeCreateMedicalRecordInputMock,
  createMedicalRecord: createMedicalRecordMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

vi.mock('@/lib/medical-records/ai-tags', () => ({
  enqueueMedicalRecordAiTagJob: vi.fn(async () => undefined),
}))

function createMedicalSupabaseMock() {
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
            maybeSingle: async () => ({ data: null, error: null }),
          }
        },
      }
    },
  }
}

describe('medical-records routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createMedicalSupabaseMock(),
      storeId: 'store-1',
    })
    normalizeCreateMedicalRecordInputMock.mockReturnValue({})
  })

  // TRACE-142
  it('POST /api/medical-records returns service validation status/message as-is', async () => {
    const { MedicalRecordServiceError } = await import('../src/lib/medical-records/services/shared')
    createMedicalRecordMock.mockRejectedValue(new MedicalRecordServiceError('pet_id is required.', 400))
    const { POST } = await import('../src/app/api/medical-records/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/medical-records', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'pet_id is required.' })
  })

  // TRACE-143
  it('POST /api/medical-records returns 500 for unexpected error', async () => {
    createMedicalRecordMock.mockRejectedValue(new Error('database unavailable'))
    const { POST } = await import('../src/app/api/medical-records/route')
    const form = new FormData()
    const response = await POST(
      new Request('http://localhost/api/medical-records', {
        method: 'POST',
        body: form,
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'database unavailable' })
  })
})
