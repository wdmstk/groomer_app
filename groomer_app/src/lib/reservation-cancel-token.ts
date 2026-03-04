import { createHmac, timingSafeEqual } from 'crypto'

type CancelTokenPayload = {
  appointmentId: string
  storeId: string
  exp: number
}

const DEFAULT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60

function getSecret() {
  return process.env.RESERVATION_CANCEL_SECRET || process.env.CRON_SECRET_KEY || ''
}

function toBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function fromBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payloadBase64: string, secret: string) {
  return createHmac('sha256', secret).update(payloadBase64).digest('base64url')
}

export function createReservationCancelToken({
  appointmentId,
  storeId,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
}: {
  appointmentId: string
  storeId: string
  expiresInSeconds?: number
}) {
  const secret = getSecret()
  if (!secret) {
    throw new Error('Missing RESERVATION_CANCEL_SECRET or CRON_SECRET_KEY')
  }

  const payload: CancelTokenPayload = {
    appointmentId,
    storeId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const payloadBase64 = toBase64Url(JSON.stringify(payload))
  const signature = sign(payloadBase64, secret)
  return `${payloadBase64}.${signature}`
}

export function verifyReservationCancelToken(token: string) {
  const secret = getSecret()
  if (!secret) {
    throw new Error('Missing RESERVATION_CANCEL_SECRET or CRON_SECRET_KEY')
  }

  const [payloadBase64, signature] = token.split('.')
  if (!payloadBase64 || !signature) {
    return { valid: false as const, reason: 'invalid_format' as const }
  }

  const expectedSignature = sign(payloadBase64, secret)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false as const, reason: 'invalid_signature' as const }
  }

  let payload: CancelTokenPayload
  try {
    payload = JSON.parse(fromBase64Url(payloadBase64)) as CancelTokenPayload
  } catch {
    return { valid: false as const, reason: 'invalid_payload' as const }
  }

  if (!payload.appointmentId || !payload.storeId || !payload.exp) {
    return { valid: false as const, reason: 'invalid_payload' as const }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    return { valid: false as const, reason: 'expired' as const }
  }

  return { valid: true as const, payload }
}
