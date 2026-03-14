import crypto from 'crypto'

function getAuditHashSalt() {
  return process.env.AUDIT_LOG_HASH_SALT ?? ''
}

export function toPrivacyHash(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  return crypto.createHash('sha256').update(`${getAuditHashSalt()}:${normalized}`).digest('hex')
}

export function pickClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }
  return headers.get('x-real-ip')
}
