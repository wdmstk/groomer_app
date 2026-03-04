import { createHmac, timingSafeEqual } from 'crypto'

export type SignedPetQrPayload = {
  v: 2
  customer_id: string
  customer_name: string
  phone_number: string
  pet_id: string
  pet_name: string
  pet_breed: string
  issued_at: string
  sig: string
}

type SignTarget = Omit<SignedPetQrPayload, 'sig'>

function getSigningSecret() {
  return process.env.QR_PAYLOAD_SIGNING_SECRET || process.env.CRON_SECRET_KEY || ''
}

function normalize(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function buildSignTarget(payload: {
  customerId: string
  customerName: string
  phoneNumber?: string | null
  petId: string
  petName: string
  petBreed?: string | null
  issuedAt?: string | null
}): SignTarget {
  return {
    v: 2,
    customer_id: normalize(payload.customerId),
    customer_name: normalize(payload.customerName),
    phone_number: normalize(payload.phoneNumber),
    pet_id: normalize(payload.petId),
    pet_name: normalize(payload.petName),
    pet_breed: normalize(payload.petBreed),
    issued_at: payload.issuedAt?.trim() || new Date().toISOString(),
  }
}

function serializeForSigning(target: SignTarget) {
  return JSON.stringify(target)
}

function signSerialized(serialized: string, secret: string) {
  return createHmac('sha256', secret).update(serialized).digest('hex')
}

function secureEq(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function buildSignedPetQrPayload(params: {
  customerId: string
  customerName: string
  phoneNumber?: string | null
  petId: string
  petName: string
  petBreed?: string | null
}) {
  const secret = getSigningSecret()
  if (!secret) {
    throw new Error('Missing QR_PAYLOAD_SIGNING_SECRET or CRON_SECRET_KEY')
  }
  const target = buildSignTarget(params)
  const serialized = serializeForSigning(target)
  const sig = signSerialized(serialized, secret)
  return { ...target, sig } satisfies SignedPetQrPayload
}

export function verifySignedPetQrPayload(raw: string) {
  const secret = getSigningSecret()
  if (!secret) {
    return { ok: false as const, reason: 'missing_secret' as const, payload: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false as const, reason: 'invalid_json' as const, payload: null }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false as const, reason: 'invalid_shape' as const, payload: null }
  }

  const data = parsed as Partial<SignedPetQrPayload>
  if (data.v !== 2 || typeof data.sig !== 'string') {
    return { ok: false as const, reason: 'unsigned_or_legacy' as const, payload: null }
  }

  const target = buildSignTarget({
    customerId: data.customer_id ?? '',
    customerName: data.customer_name ?? '',
    phoneNumber: data.phone_number ?? '',
    petId: data.pet_id ?? '',
    petName: data.pet_name ?? '',
    petBreed: data.pet_breed ?? '',
    issuedAt: data.issued_at ?? '',
  })

  const expected = signSerialized(serializeForSigning(target), secret)
  if (!secureEq(expected, data.sig)) {
    return { ok: false as const, reason: 'signature_mismatch' as const, payload: null }
  }

  return {
    ok: true as const,
    reason: null,
    payload: { ...target, sig: data.sig } satisfies SignedPetQrPayload,
  }
}
