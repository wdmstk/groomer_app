import crypto from 'crypto'

export const MEDICAL_RECORD_SHARE_DAYS = 7

export function generateMedicalRecordShareToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function hashMedicalRecordShareToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function getMedicalRecordShareExpiresAt(days = MEDICAL_RECORD_SHARE_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
