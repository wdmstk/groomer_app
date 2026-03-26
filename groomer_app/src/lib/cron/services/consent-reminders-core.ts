export type ConsentReminderType = 'after_24h' | 'after_72h' | 'before_expiry'

export function resolveConsentReminderAppBaseUrl(env: {
  APP_BASE_URL?: string
  NEXT_PUBLIC_APP_URL?: string
}) {
  const fromEnv = env.APP_BASE_URL ?? env.NEXT_PUBLIC_APP_URL ?? ''
  return fromEnv.trim().replace(/\/$/, '')
}

export function hoursSince(iso: string, nowMs: number) {
  const startedAt = new Date(iso).getTime()
  if (!Number.isFinite(startedAt)) return 0
  return (nowMs - startedAt) / (1000 * 60 * 60)
}

export function shouldSendConsentReminder(params: {
  type: ConsentReminderType
  createdAt: string
  tokenExpiresAt: string | null
  nowMs: number
}) {
  const elapsedHours = hoursSince(params.createdAt, params.nowMs)
  if (params.type === 'after_24h') return elapsedHours >= 24
  if (params.type === 'after_72h') return elapsedHours >= 72
  if (!params.tokenExpiresAt) return false
  const expiresAt = new Date(params.tokenExpiresAt).getTime()
  if (!Number.isFinite(expiresAt)) return false
  const diffHours = (expiresAt - params.nowMs) / (1000 * 60 * 60)
  return diffHours <= 24 && diffHours > 0
}
