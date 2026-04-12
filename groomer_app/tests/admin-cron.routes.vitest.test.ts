import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDeveloperAdminMock,
  runNotificationUsageBillingJobMock,
  findBillingWebhookEventByIdMock,
  markBillingWebhookEventResultMock,
  processStripeBillingEventMock,
  processKomojuBillingEventMock,
  listJobLocksMock,
  listFailedJobRunsMock,
  listJobRunsMock,
  getJobRunByIdMock,
  rerunCronJobMock,
  getMedicalRecordAiVideoDashboardMock,
  assertAuthorizedCronRequestMock,
  startJobRunMock,
  finishJobRunMock,
  runBillingRemindersJobMock,
  runBillingStatusSyncJobMock,
  runBillingTrialRolloverJobMock,
  runConsentRemindersJobMock,
  runHotelVaccineAlertsJobMock,
  runJournalLineNotificationsJobMock,
  runMedicalRecordAiAssistJobsMock,
  runMedicalRecordAiTagsJobMock,
  runMedicalRecordAiVideoPipelineMock,
  runNextVisitSuggestionsJobMock,
  runPurgeMemberPortalAccessLogsJobMock,
  runAppointmentRemindersJobMock,
  runScanStorageOrphansJobMock,
} = vi.hoisted(() => ({
  requireDeveloperAdminMock: vi.fn(),
  runNotificationUsageBillingJobMock: vi.fn(),
  findBillingWebhookEventByIdMock: vi.fn(),
  markBillingWebhookEventResultMock: vi.fn(),
  processStripeBillingEventMock: vi.fn(),
  processKomojuBillingEventMock: vi.fn(),
  listJobLocksMock: vi.fn(),
  listFailedJobRunsMock: vi.fn(),
  listJobRunsMock: vi.fn(),
  getJobRunByIdMock: vi.fn(),
  rerunCronJobMock: vi.fn(),
  getMedicalRecordAiVideoDashboardMock: vi.fn(),
  assertAuthorizedCronRequestMock: vi.fn(),
  startJobRunMock: vi.fn(),
  finishJobRunMock: vi.fn(),
  runBillingRemindersJobMock: vi.fn(),
  runBillingStatusSyncJobMock: vi.fn(),
  runBillingTrialRolloverJobMock: vi.fn(),
  runConsentRemindersJobMock: vi.fn(),
  runHotelVaccineAlertsJobMock: vi.fn(),
  runJournalLineNotificationsJobMock: vi.fn(),
  runMedicalRecordAiAssistJobsMock: vi.fn(),
  runMedicalRecordAiTagsJobMock: vi.fn(),
  runMedicalRecordAiVideoPipelineMock: vi.fn(),
  runNextVisitSuggestionsJobMock: vi.fn(),
  runPurgeMemberPortalAccessLogsJobMock: vi.fn(),
  runAppointmentRemindersJobMock: vi.fn(),
  runScanStorageOrphansJobMock: vi.fn(),
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
  listFailedJobRuns: listFailedJobRunsMock,
  listJobRuns: listJobRunsMock,
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

vi.mock('@/lib/cron/services/billing-status-sync', () => ({
  runBillingStatusSyncJob: runBillingStatusSyncJobMock,
}))

vi.mock('@/lib/cron/services/billing-trial-rollover', () => ({
  runBillingTrialRolloverJob: runBillingTrialRolloverJobMock,
}))

vi.mock('@/lib/cron/services/consent-reminders', () => ({
  runConsentRemindersJob: runConsentRemindersJobMock,
}))

vi.mock('@/lib/cron/services/hotel-vaccine-alerts', () => ({
  runHotelVaccineAlertsJob: runHotelVaccineAlertsJobMock,
}))

vi.mock('@/lib/cron/services/journal-line-notifications', () => ({
  runJournalLineNotificationsJob: runJournalLineNotificationsJobMock,
}))

vi.mock('@/lib/cron/services/medical-record-ai-assist', () => ({
  runMedicalRecordAiAssistJobs: runMedicalRecordAiAssistJobsMock,
}))

vi.mock('@/lib/cron/services/medical-record-ai-tags', () => ({
  runMedicalRecordAiTagsJob: runMedicalRecordAiTagsJobMock,
}))

vi.mock('@/lib/cron/services/medical-record-ai-video', () => ({
  runMedicalRecordAiVideoPipeline: runMedicalRecordAiVideoPipelineMock,
}))

vi.mock('@/lib/cron/services/next-visit-suggestions', () => ({
  runNextVisitSuggestionsJob: runNextVisitSuggestionsJobMock,
}))

vi.mock('@/lib/cron/services/purge-member-portal-access-logs', () => ({
  runPurgeMemberPortalAccessLogsJob: runPurgeMemberPortalAccessLogsJobMock,
}))

vi.mock('@/lib/cron/services/appointment-reminders', () => ({
  runAppointmentRemindersJob: runAppointmentRemindersJobMock,
}))

vi.mock('@/lib/cron/services/scan-storage-orphans', () => ({
  runScanStorageOrphansJob: runScanStorageOrphansJobMock,
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
    listFailedJobRunsMock.mockResolvedValue({ items: [] })
    listJobRunsMock.mockResolvedValue({ items: [] })
    getJobRunByIdMock.mockResolvedValue({ id: 'run-1' })
    rerunCronJobMock.mockResolvedValue({ jobRunId: 'run-2' })
    getMedicalRecordAiVideoDashboardMock.mockResolvedValue({ summary: { queued: 0 } })
    assertAuthorizedCronRequestMock.mockImplementation(() => undefined)
    startJobRunMock.mockResolvedValue('job-run-1')
    finishJobRunMock.mockResolvedValue(undefined)
    runBillingRemindersJobMock.mockResolvedValue({ reminded: 2 })
    runBillingStatusSyncJobMock.mockResolvedValue({ synced: 1 })
    runBillingTrialRolloverJobMock.mockResolvedValue({ transitioned: 1 })
    runConsentRemindersJobMock.mockResolvedValue({ sent: 1 })
    runHotelVaccineAlertsJobMock.mockResolvedValue({ notified: 1 })
    runJournalLineNotificationsJobMock.mockResolvedValue({ notified: 1 })
    runMedicalRecordAiAssistJobsMock.mockResolvedValue({ processed: 1 })
    runMedicalRecordAiTagsJobMock.mockResolvedValue({ processed: 1 })
    runMedicalRecordAiVideoPipelineMock.mockResolvedValue({ processed: 1 })
    runNextVisitSuggestionsJobMock.mockResolvedValue({ suggested: 1 })
    runPurgeMemberPortalAccessLogsJobMock.mockResolvedValue({ deleted: 1 })
    runAppointmentRemindersJobMock.mockResolvedValue({ reminded: 1 })
    runScanStorageOrphansJobMock.mockResolvedValue({ scanned: 1 })
    runNotificationUsageBillingJobMock.mockResolvedValue({ ok: true, billedStores: 1 })
  })

  // TRACE-200
  // TRACE-343
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
  // TRACE-344
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
  // TRACE-345
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
  // TRACE-346
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
  // TRACE-350
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
  // TRACE-349
  it('GET /api/admin/cron/medical-record-ai-video/dashboard forwards parsed limit', async () => {
    const { GET } = await import('../src/app/api/admin/cron/medical-record-ai-video/dashboard/route')
    const response = await GET(
      new Request('http://localhost/api/admin/cron/medical-record-ai-video/dashboard?limit=15')
    )

    expect(response.status).toBe(200)
    expect(getMedicalRecordAiVideoDashboardMock).toHaveBeenCalledWith({ limit: 15 })
  })

  // TRACE-207
  // TRACE-359
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
  // TRACE-369
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

  // TRACE-347
  it('GET /api/admin/cron/job-runs/failed forwards parsed filters', async () => {
    const { GET } = await import('../src/app/api/admin/cron/job-runs/failed/route')
    const response = await GET(
      new Request(
        'http://localhost/api/admin/cron/job-runs/failed?jobName=sync&trigger=manual&requestedByUserId=user-1&limit=20&page=2&startedFrom=2026-04-01&startedTo=2026-04-30'
      )
    )

    expect(response.status).toBe(200)
    expect(listFailedJobRunsMock).toHaveBeenCalledWith({
      jobName: 'sync',
      trigger: 'manual',
      requestedByUserId: 'user-1',
      limit: 20,
      page: 2,
      startedFrom: '2026-04-01',
      startedTo: '2026-04-30',
    })
  })

  // TRACE-348
  it('GET /api/admin/cron/job-runs returns CronServiceError status/message', async () => {
    listJobRunsMock.mockRejectedValueOnce(new MockCronServiceError('bad request', 400))
    const { GET } = await import('../src/app/api/admin/cron/job-runs/route')
    const response = await GET(new Request('http://localhost/api/admin/cron/job-runs'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: 'bad request' })
  })

  // TRACE-360
  it('GET /api/cron/billing-status-sync runs job with expected job name', async () => {
    const { GET } = await import('../src/app/api/cron/billing-status-sync/route')
    const response = await GET(new Request('http://localhost/api/cron/billing-status-sync'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'billing-status-sync' })
    expect(runBillingStatusSyncJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-361
  it('GET /api/cron/billing-trial-rollover runs rollover job', async () => {
    const { GET } = await import('../src/app/api/cron/billing-trial-rollover/route')
    const response = await GET(new Request('http://localhost/api/cron/billing-trial-rollover'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'billing-trial-rollover' })
    expect(runBillingTrialRolloverJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-362
  it('GET /api/cron/consent-reminders runs reminder job', async () => {
    const { GET } = await import('../src/app/api/cron/consent-reminders/route')
    const response = await GET(new Request('http://localhost/api/cron/consent-reminders'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'consent-reminders' })
    expect(runConsentRemindersJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-363
  it('GET /api/cron/hotel-vaccine-alerts runs alert job', async () => {
    const { GET } = await import('../src/app/api/cron/hotel-vaccine-alerts/route')
    const response = await GET(new Request('http://localhost/api/cron/hotel-vaccine-alerts'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'hotel-vaccine-alerts' })
    expect(runHotelVaccineAlertsJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-364
  it('GET /api/cron/journal-line-notifications runs notification job', async () => {
    const { GET } = await import('../src/app/api/cron/journal-line-notifications/route')
    const response = await GET(new Request('http://localhost/api/cron/journal-line-notifications'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'journal-line-notifications' })
    expect(runJournalLineNotificationsJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-365
  it('GET /api/cron/medical-record-ai-assist returns 500 and closes run when worker fails', async () => {
    runMedicalRecordAiAssistJobsMock.mockRejectedValueOnce(new Error('assist failed'))
    const { GET } = await import('../src/app/api/cron/medical-record-ai-assist/route')
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ message: 'assist failed' })
    expect(finishJobRunMock).toHaveBeenCalledWith({
      jobRunId: 'job-run-1',
      status: 'failed',
      lastError: 'assist failed',
    })
  })

  // TRACE-366
  it('GET /api/cron/medical-record-ai-tags runs tags job', async () => {
    const { GET } = await import('../src/app/api/cron/medical-record-ai-tags/route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'medical-record-ai-tags' })
    expect(runMedicalRecordAiTagsJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-367
  it('GET /api/cron/medical-record-ai-video runs video pipeline job', async () => {
    const { GET } = await import('../src/app/api/cron/medical-record-ai-video/route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'medical-record-ai-video' })
    expect(runMedicalRecordAiVideoPipelineMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-368
  it('GET /api/cron/next-visit-suggestions maps unauthorized CronServiceError', async () => {
    assertAuthorizedCronRequestMock.mockImplementationOnce(() => {
      throw new MockCronServiceError('unauthorized', 401)
    })
    const { GET } = await import('../src/app/api/cron/next-visit-suggestions/route')
    const response = await GET(new Request('http://localhost/api/cron/next-visit-suggestions'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'unauthorized' })
  })

  // TRACE-370
  it('GET /api/cron/purge-member-portal-access-logs runs cleanup job', async () => {
    const { GET } = await import('../src/app/api/cron/purge-member-portal-access-logs/route')
    const response = await GET(new Request('http://localhost/api/cron/purge-member-portal-access-logs'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'purge-member-portal-access-logs' })
    expect(runPurgeMemberPortalAccessLogsJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-371
  it('GET /api/cron/remind-appointments runs reminders job', async () => {
    const { GET } = await import('../src/app/api/cron/remind-appointments/route')
    const response = await GET(new Request('http://localhost/api/cron/remind-appointments'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'remind-appointments' })
    expect(runAppointmentRemindersJobMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-372
  it('GET /api/cron/scan-storage-orphans runs scan job', async () => {
    const { GET } = await import('../src/app/api/cron/scan-storage-orphans/route')
    const response = await GET(new Request('http://localhost/api/cron/scan-storage-orphans'))

    expect(response.status).toBe(200)
    expect(startJobRunMock).toHaveBeenCalledWith({ jobName: 'scan-storage-orphans' })
    expect(runScanStorageOrphansJobMock).toHaveBeenCalledTimes(1)
  })
})
