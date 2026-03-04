async function hmacSha256Hex(secret: string, payload: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function verifyStripeSignature({
  payload,
  header,
  secret,
}: {
  payload: string
  header: string | null
  secret: string
}) {
  if (!header) return false
  const entries = header.split(',').map((v) => v.trim())
  const timestamp = entries.find((v) => v.startsWith('t='))?.slice(2)
  const v1 = entries.find((v) => v.startsWith('v1='))?.slice(3)
  if (!timestamp || !v1) return false
  const signedPayload = `${timestamp}.${payload}`
  const expected = await hmacSha256Hex(secret, signedPayload)
  return timingSafeEqual(expected, v1)
}

export async function verifyKomojuSignature({
  payload,
  header,
  secret,
}: {
  payload: string
  header: string | null
  secret: string
}) {
  if (!header) return false
  const expected = await hmacSha256Hex(secret, payload)
  return timingSafeEqual(expected, header)
}
