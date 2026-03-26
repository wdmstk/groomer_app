import crypto from 'crypto'

export const CONSENT_SIGNATURE_BUCKET = process.env.SUPABASE_CONSENT_SIGNATURE_BUCKET ?? 'consent-signatures'
export const CONSENT_PDF_BUCKET = process.env.SUPABASE_CONSENT_PDF_BUCKET ?? 'consent-pdfs'

function getConsentTokenPepper() {
  return process.env.CONSENT_TOKEN_PEPPER ?? process.env.CRON_SECRET_KEY ?? ''
}

export function createConsentToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function hashConsentToken(token: string) {
  return crypto.createHash('sha256').update(`${getConsentTokenPepper()}:${token}`).digest('hex')
}

export function parseString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function parseIntWithMin(value: unknown, minValue: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const rounded = Math.floor(num)
  if (rounded < minValue) return null
  return rounded
}

export function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}

export function decodeSignaturePng(value: string) {
  const raw = value.trim()
  const base64 = raw.startsWith('data:image/png;base64,')
    ? raw.slice('data:image/png;base64,'.length)
    : raw
  return Buffer.from(base64, 'base64')
}
