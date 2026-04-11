import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDeveloperAdminMock,
  runNotificationUsageBillingJobMock,
  findBillingWebhookEventByIdMock,
  markBillingWebhookEventResultMock,
  processStripeBillingEventMock,
  processKomojuBillingEventMock,
  listJobLocksMock,
  getJobRunByIdMock,
  rerunCronJobMock,
  getMedicalRecordAiVideoDashboardMock,
  assertAuthorizedCronRequestMock,
  startJobRunMock,
  finishJobRunMock,
  runBillingRemindersJobMock,
} = vi.hoisted(() => ({
  requireDeveloperAdminMock: vi.fn(),
  runNotificationUsageBillingJobMock: vi.fn(),
  findBillingWebhookEventByIdMock: vi.fn(),
  markBillingWebhookEventResultMock: vi.fn(),
  processStripeBillingEventMock: vi.fn(),
  processKomojuBillingEventMock: vi.fn(),
  listJobLocksMock: vi.fn(),
  getJobRunByIdMock: vi.fn(),
  rerunCronJobMock: vi.fn(),
  getMedicalRecordAiVideoDashboardMock: vi.fn(),
  assertAuthorizedCronRequestMock: vi.fn(),
  startJobRunMock: vi.fn(),
  finishJobRunMock: vi.fn(),
  runBillingRemindersJobMock: vi.fn(),
}))

class MockCronServiceError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

vi.mock('@/lib/auth/developer-admin', () => ({
  requireDeveloperAdmin: requireDeveloperAdminMock,
}))

vi.mock('@/lib/cron/services/notification-usage-billing', () => ({
  runNotificationUsageBillingJob: runNotificationUsageBillingJobMock,
}))

vi.mock('@/lib/billing/db', () => ({
  findBillingWebhookEventById: findBillingWebhookEventByIdMock,
  markBillingWebhookEventResult: markBillingWebhookEventResultMock,
}))

vi.mock('@/lib/billing/webhook-event-processors', () => ({
  processStripeBillingEvent: processStripeBillingEventMock,
  processKomojuBillingEvent: processKomojuBillingEventMock,
}))

vi.mock('@/lib/cron/services/job-locks', () => ({
  listJobLocks: listJobLocksMock,
}))

vi.mock('@/lib/cron/services/job-runs', () => ({
  getJobRunById: getJobRunByIdMock,
}))

vi.mock('@/lib/cron/services/rerun', () => ({
  rerunCronJob: rerunCronJobMock,
}))

vi.mock('@/lib/cron/services/medical-record-ai-video-dashboard', () => ({
  getMedicalRecordAiVideoDashboard: getMedicalRecordAiVideoDashboardMock,
}))

vi.mock('@/lib/cron/shared', () => ({
  CronServiceError: MockCronServiceError,
  assertAuthorizedCronRequest: assertAuthorizedCronRequestMock,
  startJobRun: startJobRunMock,
  finishJobRun: finishJobRunMock,
}))

vi.mock('@/lib/cron/services/billing-reminders', () => ({
  runBillingRemindersJob: runBillingRemindersJobMock,
}))

describe('admin/cron routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    requireDeveloperAdminMock.mockResolvedValue({
      ok: true,
      status: 200,
      message: 'ok',
      user: { id: 'dev-1', email: 'dev@example.com' },
    })
    runNotificationUsageBillingJobMock.mockResolvedValue({ ok: true, processedStores: 1 })
    findBillingWebhookEventByIdMock.mockResolvedValue(null)
    markBillingWebhookEventResultMock.mockResolvedValue(undefined)
    processStripeBillingEventMock.mockResolvedValue(undefined)
    processKomojuBillingEventMock.mockResolvedValue(undefined)
    listJobLocksMock.mockResolvedValue({ locks: [] })
    getJobRunByIdMock.mockResolvedValue({ id: 'run-1' })
    rerunCronJobMock.mockResolvedValue({ jobRunId: 'run-2' })
    getMedicalRecordAiVideoDashboardMock.mockResolvedValue({ summary: { queued: 0 } })
    assertAuthorizedCronRequestMock.mockImplementation(() => undefined)
    startJobRunMock.mockResolvedValue('job-run-1')
    finishJobRunMock.mockResolvedValue(undefined)
    runBillingRemindersJobMock.mockResolvedValue({ reminded: 2 })
    runNotificationUsageBillingJobMock.mockResolvedValue({ ok: true, billedStores: 1 })
  })

  // TRACE-200
  it('POST /api/admin/billing/notification-usage/rehearsal returns 400 for invalid targetMonthJst', async () => {
    const { POST } = await import('../src/app/api/admin/billing/notification-usage/rehearsal/route')
    const response = await POST(
      new Request('http://localhost/api/admin/billing/notification-usage/rehearsal', {
        method: 'POST',
        body: JSON.stringify({ targetMonthJst: '2026/04' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'targetMonthJst is required. format=YYYY-MM',
    })
  })

  // TRACE-201
  it('POST /api/admin/billing/webhook-events/retry returns 400 when webhookEventId is missing', async () => {
    const { POST } = await import('../src/app/api/admin/billing/webhook-events/retry/route')
    const response = await POST(
      new Request('http://localhost/api/admin/billing/webhook-events/retry', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'webhookEventId is required.' })
  })

  // TRACE-202
  it('POST /api/admin/billing/webhook-events/retry returns 404 when event log is not found', async () => {
    const { POST } = await import('../src/app/api/admin/billing/webhook-events/retry/route')
    const response = await POST(
      new Request('http://localhost/api/admin/billing/webhook-events/retry', {
        method: 'POST',
        body: JSON.stringify({ webhookEventId: 'missing-id' }),
      })
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Webhook event not found.' })
  })

  // TRACE-203
  it('GET /api/admin/cron/job-locks maps developer guard failure status/message', async () => {
    requireDeveloperAdminMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    })

    const { GET } = await import('../src/app/api/admin/cron/job-locks/route')
    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: 'Forbidden' })
  })

  // TRACE-204
  it('GET /api/admin/cron/job-runs/[job_run_id] maps CronServiceError status/message', async () => {
    getJobRunByIdMock.mockRejectedValueOnce(new MockCronServiceError('not found', 404))
    const { GET } = await import('../src/app/api/admin/cron/job-runs/[job_run_id]/route')
    const response = await GET(new Request('http://localhost/api/admin/cron/job-runs/run-404'), {
      params: Promise.resolve({ job_run_id: 'run-404' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'not found' })
  })

  // TRACE-205
  it('POST /api/admin/cron/rerun returns rerun payload with completion message', async () => {
    rerunCronJobMock.mockResolvedValueOnce({ jobRunId: 'rerun-1', status: 'succeeded' })
    const { POST } = await import('../src/app/api/admin/cron/rerun/route')
    const response = await POST(
      new Request('http://localhost/api/admin/cron/rerun', {
        method: 'POST',
        body: JSON.stringify({ jobName: 'next-visit-suggestions', reason: 'manual test' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Job rerun completed.',
      jobRunId: 'rerun-1',
      status: 'succeeded',
    })
  })

  // TRACE-206
  it('GET /api/admin/cron/medical-record-ai-video/dashboard forwards parsed limit', async () => {
    const { GET } = await import('../src/app/api/admin/cron/medical-record-ai-video/dashboard/route')
    const response = await GET(
      new Request('http://localhost/api/admin/cron/medical-record-ai-video/dashboard?limit=15')
    )

    expect(response.status).toBe(200)
    expect(getMedicalRecordAiVideoDashboardMock).toHaveBeenCalledWith({ limit: 15 })
  })

  // TRACE-207
  it('GET /api/cron/billing-reminders maps unauthorized CronServiceError and records failed run', async () => {
    assertAuthorizedCronRequestMock.mockImplementationOnce(() => {
      throw new MockCronServiceError('Unauthorized', 401)
    })

    const { GET } = await import('../src/app/api/cron/billing-reminders/route')
    const response = await GET(new Request('http://localhost/api/cron/billing-reminders'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
    expect(finishJobRunMock).toHaveBeenCalledWith({
      jobRunId: null,
      status: 'failed',
      lastError: 'Unauthorized',
    })
  })

  // TRACE-208
  it('GET /api/cron/notification-usage-billing starts and finishes job run on success', async () => {
    const { GET } = await import('../src/app/api/cron/notification-usage-billing/route')
    const response = await GET(new Request('http://localhost/api/cron/notification-usage-billing'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'notification-usage-billing' })
    expect(runNotificationUsageBillingJobMock).toHaveBeenCalledWith({ jobRunId: 'job-run-1' })
    expect(finishJobRunMock).toHaveBeenCalledWith({
      jobRunId: 'job-run-1',
      status: 'succeeded',
      meta: { ok: true, billedStores: 1 },
    })
  })
})
