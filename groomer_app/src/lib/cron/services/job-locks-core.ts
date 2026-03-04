export class JobLocksServiceError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'JobLocksServiceError'
    this.status = status
  }
}

type ManualLockReleaseAuditEntry = {
  releasedAt: string
  requestedByUserId: string
  requestedByEmail: string | null
  lockJobName: string
  lockJobRunId: string
}

function normalizeAuditObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return { ...(value as Record<string, unknown>) }
}

export function appendManualLockReleaseAudit(params: {
  currentMeta: Record<string, unknown> | null | undefined
  releasedAt: string
  requestedByUserId: string
  requestedByEmail?: string | null
  lockJobName: string
  lockJobRunId: string
}) {
  const currentMeta = normalizeAuditObject(params.currentMeta)
  const currentAudit = normalizeAuditObject(currentMeta.audit)
  const currentEntries = Array.isArray(currentAudit.manualLockReleases)
    ? currentAudit.manualLockReleases.filter((entry) => entry && typeof entry === 'object')
    : []

  const nextEntry: ManualLockReleaseAuditEntry = {
    releasedAt: params.releasedAt,
    requestedByUserId: params.requestedByUserId,
    requestedByEmail: params.requestedByEmail ?? null,
    lockJobName: params.lockJobName,
    lockJobRunId: params.lockJobRunId,
  }

  return {
    ...currentMeta,
    audit: {
      ...currentAudit,
      manualLockReleases: [...currentEntries, nextEntry].slice(-20),
    },
  }
}

export function validateReleaseJobLockInput(params: {
  jobRunId: string
  requestedByUserId: string
}) {
  if (!params.jobRunId.trim()) {
    throw new JobLocksServiceError('jobRunId is required.', 400)
  }
  if (!params.requestedByUserId.trim()) {
    throw new JobLocksServiceError('requestedByUserId is required.', 400)
  }
}
