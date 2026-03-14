import type { Json } from '@/lib/supabase/database.types'
import { isObjectRecord } from '@/lib/object-utils'
import type { JsonObject } from '@/lib/object-utils'

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

type ManualLockReleaseAuditMeta = JsonObject & {
  audit: JsonObject & {
    manualLockReleases: ManualLockReleaseAuditEntry[]
  }
}

function normalizeAuditObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as JsonObject
  }
  return { ...value } as JsonObject
}

function isManualLockReleaseAuditEntry(value: unknown): value is ManualLockReleaseAuditEntry {
  if (!isObjectRecord(value)) return false
  const row = value
  return (
    typeof row.releasedAt === 'string' &&
    typeof row.requestedByUserId === 'string' &&
    (typeof row.requestedByEmail === 'string' || row.requestedByEmail === null) &&
    typeof row.lockJobName === 'string' &&
    typeof row.lockJobRunId === 'string'
  )
}

export function appendManualLockReleaseAudit(params: {
  currentMeta: Json | null | undefined
  releasedAt: string
  requestedByUserId: string
  requestedByEmail?: string | null
  lockJobName: string
  lockJobRunId: string
}): ManualLockReleaseAuditMeta {
  const currentMeta = normalizeAuditObject(params.currentMeta)
  const currentAudit = normalizeAuditObject(currentMeta.audit)
  const currentEntries = Array.isArray(currentAudit.manualLockReleases)
    ? currentAudit.manualLockReleases.filter(isManualLockReleaseAuditEntry)
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
  } as ManualLockReleaseAuditMeta
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
