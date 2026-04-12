import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  createAdminSupabaseClientMock,
  getMedicalRecordPhotoBucketMock,
  getMedicalRecordVideoBucketMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  getMedicalRecordPhotoBucketMock: vi.fn(() => 'medical-record-photos'),
  getMedicalRecordVideoBucketMock: vi.fn(() => 'medical-record-videos'),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/medical-records/photos', () => ({
  getMedicalRecordPhotoBucket: getMedicalRecordPhotoBucketMock,
  buildMedicalRecordPhotoFolder: () => 'store-1/pet-1/2026-04-01/before',
}))

vi.mock('@/lib/medical-records/videos', () => ({
  getMedicalRecordVideoBucket: getMedicalRecordVideoBucketMock,
  buildMedicalRecordVideoFolder: () => 'store-1/pet-1/2026-04-01',
}))

vi.mock('@/lib/storage-quota', () => ({
  ensureStoreHasStorageCapacity: vi.fn(async () => ({
    allowed: true,
    cleanedUpCount: 0,
    freedBytes: 0,
    quota: {
      totalLimitBytes: 1024 * 1024 * 1024,
      usageBytes: 0,
      policy: 'block_uploads',
    },
  })),
  formatBytesToJa: (value: number) => `${value}B`,
}))

function createAiReportsSupabaseMock(options?: {
  reportMonth?: string
  reportData?: Record<string, unknown> | null
  reportError?: { message: string } | null
}) {
  const reportMonth = options?.reportMonth ?? '2026-04'
  const reportData = options?.reportData ?? { id: 'report-1', report_month: reportMonth }
  const reportError = options?.reportError ?? null

  return {
    from(table: string) {
      if (table !== 'store_ai_monthly_reports') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq(column: string, value: string) {
              if (column === 'report_month') {
                expect(value).toBe(reportMonth)
              }
              return this
            },
            maybeSingle: async () => ({ data: reportError ? null : reportData, error: reportError }),
          }
        },
      }
    },
  }
}

describe('platform/observability routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    createStoreScopedClientMock.mockResolvedValue({
      storeId: 'store-1',
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: { id: 'user-1' } } }),
        },
      },
    })
    createAdminSupabaseClientMock.mockReturnValue({
      from: () => ({
        insert: async () => ({ error: null }),
      }),
    })
  })

  // TRACE-209
  // TRACE-351
  it('GET /api/ai-reports/monthly falls back invalid month query to current YYYY-MM format', async () => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    createStoreScopedClientMock.mockResolvedValueOnce({
      storeId: 'store-1',
      supabase: createAiReportsSupabaseMock({ reportMonth: thisMonth }),
    })

    const { GET } = await import('../src/app/api/ai-reports/monthly/route')
    const response = await GET(new Request('http://localhost/api/ai-reports/monthly?month=bad-month'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      report: { id: 'report-1', report_month: thisMonth },
    })
  })

  // TRACE-210
  // TRACE-392
  it('POST /api/metrics/appointments rejects unsupported event_type with 400', async () => {
    createStoreScopedClientMock.mockResolvedValueOnce({
      storeId: 'store-1',
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: { id: 'user-1' } } }),
        },
        from: () => ({
          insert: async () => ({ error: null }),
        }),
      },
    })

    const { POST } = await import('../src/app/api/metrics/appointments/route')
    const response = await POST(
      new Request('http://localhost/api/metrics/appointments', {
        method: 'POST',
        body: JSON.stringify({ event_type: 'unsupported_event' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'Unsupported appointment metric event_type.',
    })
  })

  // TRACE-211
  // TRACE-396
  it('POST /api/security/csp-report returns 204 for invalid payload without insert', async () => {
    const { POST } = await import('../src/app/api/security/csp-report/route')
    const response = await POST(
      new Request('http://localhost/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid-json',
      })
    )

    expect(response.status).toBe(204)
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled()
  })

  // TRACE-212
  it('POST /api/upload rejects non-image file with 400', async () => {
    const { POST } = await import('../src/app/api/upload/route')
    const response = await POST({
      formData: async () => ({
        get: (key: string) =>
          key === 'file'
            ? ({ name: 'memo.txt', type: 'text/plain', size: 5 } as unknown as File)
            : null,
      }),
    } as unknown as Request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: '画像ファイルのみアップロードできます。',
    })
  })

  // TRACE-213
  it('POST /api/upload/video rejects oversized file with 400', async () => {
    const { POST } = await import('../src/app/api/upload/video/route')
    const response = await POST({
      formData: async () => ({
        get: (key: string) =>
          key === 'file'
            ? ({ name: 'movie.mp4', type: 'video/mp4', size: 50 * 1024 * 1024 + 1 } as unknown as File)
            : null,
      }),
    } as unknown as Request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'ファイルサイズは50MB以下にしてください。',
    })
  })
})
