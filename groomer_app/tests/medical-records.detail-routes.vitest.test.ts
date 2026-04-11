import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createStoreScopedClientMock,
  createAdminSupabaseClientMock,
  createMedicalRecordShareLinkMock,
  updateMedicalRecordMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createAdminSupabaseClientMock: vi.fn(),
  createMedicalRecordShareLinkMock: vi.fn(),
  updateMedicalRecordMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}))

vi.mock('@/lib/medical-records/share', () => ({
  buildMedicalRecordShareUrl: vi.fn(() => 'https://example.com/shared/token'),
  createMedicalRecordShareLink: createMedicalRecordShareLinkMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: vi.fn(async () => undefined),
}))

vi.mock('@/lib/medical-records/services/update', () => ({
  normalizeUpdateMedicalRecordFormInput: vi.fn(() => ({})),
  normalizeUpdateMedicalRecordJsonInput: vi.fn((value) => value),
  updateMedicalRecord: updateMedicalRecordMock,
}))

vi.mock('@/lib/medical-records/ai-tags', () => ({
  enqueueMedicalRecordAiTagJob: vi.fn(async () => ({ id: 'job-1' })),
  runMedicalRecordAiTagJob: vi.fn(async () => undefined),
}))

vi.mock('@/lib/line', () => ({
  sendLineMessage: vi.fn(async () => ({ success: true })),
}))

function createSupabaseMock(options?: {
  medicalRecord?: unknown
  medicalRecordError?: { message: string } | null
  appointment?: unknown
  customer?: unknown
  video?: unknown
  videoError?: { message: string } | null
}) {
  const medicalRecord = options?.medicalRecord ?? null
  const medicalRecordError = options?.medicalRecordError ?? null
  const appointment = options?.appointment ?? null
  const customer = options?.customer ?? null
  const video = options?.video ?? null
  const videoError = options?.videoError ?? null

  const auth = {
    getUser: async () => ({ data: { user: { id: 'user-1' } } }),
  }

  return {
    auth,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://example.com/signed' }, error: null })),
        copy: vi.fn(async () => ({ error: null })),
      })),
    },
    from(table: string) {
      if (table === 'medical_records') {
        const query = {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: medicalRecord, error: medicalRecordError }),
          single: async () => ({ data: medicalRecord, error: medicalRecordError }),
        }
        return query
      }

      if (table === 'appointments') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: appointment, error: null }),
        }
      }

      if (table === 'customers') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: customer, error: null }),
        }
      }

      if (table === 'notification_templates') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: null, error: null }),
        }
      }

      if (table === 'customer_notification_logs') {
        return {
          insert() {
            return {
              select() {
                return {
                  single: async () => ({ data: { id: 'log-1' }, error: null }),
                }
              },
            }
          },
          update() {
            return {
              eq: async () => ({ error: null }),
            }
          },
        }
      }

      if (table === 'medical_record_videos') {
        const query = {
          select() {
            return this
          },
          eq() {
            return this
          },
          order() {
            return this
          },
          limit() {
            return this
          },
          maybeSingle: async () => ({ data: video, error: videoError }),
          single: async () => ({ data: video, error: videoError }),
        }
        return query
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('medical-records detail routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createMedicalRecordShareLinkMock.mockResolvedValue({
      shareLink: { id: 'share-1', expires_at: '2099-01-01T00:00:00.000Z', created_by_user_id: 'user-1' },
      shareToken: 'token-1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
    updateMedicalRecordMock.mockResolvedValue({ id: 'record-1' })
    createAdminSupabaseClientMock.mockReturnValue({})
  })

  // TRACE-260
  it('POST /api/medical-records/[record_id]/share returns 404 when record is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ medicalRecord: null }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/[record_id]/share/route')
    const response = await POST(new Request('http://localhost/api/medical-records/record-1/share', { method: 'POST' }), {
      params: Promise.resolve({ record_id: 'record-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '対象カルテが見つかりません。' })
  })

  // TRACE-261
  it('POST /api/medical-records/[record_id]/share returns 400 for non-finalized record', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ medicalRecord: { id: 'record-1', status: 'draft' } }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/[record_id]/share/route')
    const response = await POST(new Request('http://localhost/api/medical-records/record-1/share', { method: 'POST' }), {
      params: Promise.resolve({ record_id: 'record-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '確定済みカルテのみ共有できます。' })
  })

  // TRACE-262
  it('POST /api/medical-records/[record_id]/share-line returns 400 when appointment is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({
        medicalRecord: { id: 'record-1', status: 'finalized', appointment_id: null, pets: { name: 'Pochi' } },
      }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/[record_id]/share-line/route')
    const response = await POST(new Request('http://localhost/api/medical-records/record-1/share-line', { method: 'POST' }), {
      params: Promise.resolve({ record_id: 'record-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: '予約情報が紐づいていないためLINE送信できません。',
    })
  })

  // TRACE-263
  it('POST /api/medical-records/[record_id]/ai-tags returns 404 when record does not exist', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ medicalRecord: null }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/[record_id]/ai-tags/route')
    const response = await POST(new Request('http://localhost/api/medical-records/record-1/ai-tags', { method: 'POST' }), {
      params: Promise.resolve({ record_id: 'record-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: '対象カルテが見つかりません。' })
  })

  // TRACE-264
  it('GET /api/medical-records/videos returns 400 when medical_record_id is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock(),
      storeId: 'store-1',
    })

    const { GET } = await import('../src/app/api/medical-records/videos/route')
    const response = await GET(new Request('http://localhost/api/medical-records/videos'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'medical_record_id is required.' })
  })

  // TRACE-265
  it('GET /api/medical-records/videos/[video_id]/play-url returns 404 when video is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ video: null }),
      storeId: 'store-1',
    })

    const { GET } = await import('../src/app/api/medical-records/videos/[video_id]/play-url/route')
    const response = await GET(new Request('http://localhost/api/medical-records/videos/video-1/play-url'), {
      params: Promise.resolve({ video_id: 'video-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Video not found.' })
  })

  // TRACE-266
  it('POST /api/medical-records/videos/[video_id]/line-short returns 400 for unsupported duration', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({
        video: {
          id: 'video-1',
          medical_record_id: 'record-1',
          storage_path: 'videos/source.mp4',
          line_short_path: null,
          duration_sec: 8,
        },
      }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/videos/[video_id]/line-short/route')
    const response = await POST(new Request('http://localhost/api/medical-records/videos/video-1/line-short', { method: 'POST' }), {
      params: Promise.resolve({ video_id: 'video-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'LINE送信用は10〜20秒の動画のみ対応です。',
    })
  })

  // TRACE-267
  it('POST /api/medical-records/videos/[video_id]/thumbnail reuses existing thumbnail_path', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({
        video: {
          id: 'video-1',
          medical_record_id: 'record-1',
          storage_path: 'videos/source.mp4',
          thumbnail_path: 'videos/thumb.jpg',
        },
      }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/videos/[video_id]/thumbnail/route')
    const response = await POST(new Request('http://localhost/api/medical-records/videos/video-1/thumbnail', { method: 'POST' }), {
      params: Promise.resolve({ video_id: 'video-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      videoId: 'video-1',
      thumbnailPath: 'videos/thumb.jpg',
      reused: true,
    })
  })

  // TRACE-268
  it('POST /api/medical-records/videos/[video_id]/share-line returns 400 when customer line_id is missing', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({
        video: {
          id: 'video-1',
          medical_record_id: 'record-1',
          storage_path: 'videos/source.mp4',
          thumbnail_path: 'videos/thumb.jpg',
          line_short_path: null,
          duration_sec: 12,
          medical_records: { id: 'record-1', appointment_id: 'appt-1', status: 'finalized' },
        },
        appointment: { id: 'appt-1', customer_id: 'customer-1' },
        customer: { id: 'customer-1', full_name: 'Taro', line_id: null },
      }),
      storeId: 'store-1',
    })

    const { POST } = await import('../src/app/api/medical-records/videos/[video_id]/share-line/route')
    const response = await POST(new Request('http://localhost/api/medical-records/videos/video-1/share-line', { method: 'POST' }), {
      params: Promise.resolve({ video_id: 'video-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'LINE送信先が未登録です。' })
  })

  // TRACE-269
  it('POST /api/medical-records/[record_id] returns 405 for unsupported method override', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock(),
      storeId: 'store-1',
    })

    const form = new FormData()
    form.set('_method', 'unknown')
    const { POST } = await import('../src/app/api/medical-records/[record_id]/route')
    const response = await POST(
      new Request('http://localhost/api/medical-records/record-1', { method: 'POST', body: form }),
      { params: Promise.resolve({ record_id: 'record-1' }) }
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-270
  it('GET /api/medical-records/[record_id] returns 500 when query fails', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ medicalRecord: null, medicalRecordError: { message: 'db error' } }),
      storeId: 'store-1',
    })

    const { GET } = await import('../src/app/api/medical-records/[record_id]/route')
    const response = await GET(new Request('http://localhost/api/medical-records/record-1'), {
      params: Promise.resolve({ record_id: 'record-1' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'db error' })
  })

  // TRACE-271
  it('PUT /api/medical-records/[record_id] returns service status/message as-is', async () => {
    const { MedicalRecordServiceError } = await import('../src/lib/medical-records/services/shared')
    updateMedicalRecordMock.mockRejectedValue(new MedicalRecordServiceError('validation failed', 422))
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseMock({ medicalRecord: { id: 'record-1' } }),
      storeId: 'store-1',
    })

    const { PUT } = await import('../src/app/api/medical-records/[record_id]/route')
    const response = await PUT(
      new Request('http://localhost/api/medical-records/record-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ record_id: 'record-1' }) }
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ message: 'validation failed' })
  })
})
