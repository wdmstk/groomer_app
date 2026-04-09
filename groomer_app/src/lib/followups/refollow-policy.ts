import { isResolvedStatus } from '@/lib/followups/shared'

export type ActiveFollowupTaskForPolicy = {
  customer_id: string | null
  status: string
  snoozed_until?: string | null
  resolved_at?: string | null
  updated_at?: string | null
}

export type RefollowDaysPolicy = {
  snoozedDays: number
  noNeedDays: number
  lostDays: number
}

export function clampRefollowDays(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(365, Math.round(value as number)))
}

export function buildBlockedCustomerIdsByRefollowPolicy(
  activeTasks: ActiveFollowupTaskForPolicy[],
  nowMs: number,
  policy: RefollowDaysPolicy
) {
  return new Set(
    activeTasks
      .filter((row) => {
        if (!row.customer_id) return false
        if (!isResolvedStatus(row.status)) {
          if (row.status !== 'snoozed') return true
          if (row.snoozed_until) {
            const snoozedUntilMs = new Date(row.snoozed_until).getTime()
            return Number.isFinite(snoozedUntilMs) && snoozedUntilMs > nowMs
          }
          const snoozedBaseMs = new Date(row.updated_at ?? '').getTime()
          if (!Number.isFinite(snoozedBaseMs)) return true
          return snoozedBaseMs + policy.snoozedDays * 24 * 60 * 60 * 1000 > nowMs
        }
        if (row.status === 'resolved_booked') return false
        const baseIso = row.resolved_at ?? row.updated_at
        if (!baseIso) return true
        const baseMs = new Date(baseIso).getTime()
        if (!Number.isFinite(baseMs)) return true
        const coolDownDays = row.status === 'resolved_no_need' ? policy.noNeedDays : policy.lostDays
        return baseMs + coolDownDays * 24 * 60 * 60 * 1000 > nowMs
      })
      .map((row) => row.customer_id as string)
  )
}
