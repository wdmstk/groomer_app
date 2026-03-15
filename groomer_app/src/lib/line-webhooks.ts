function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return result === 0
}

async function hmacSha256Base64(secret: string, payload: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Buffer.from(signature).toString('base64')
}

export async function verifyLineSignature(params: {
  payload: string
  header: string | null
  secret: string
}) {
  if (!params.header) return false
  const expected = await hmacSha256Base64(params.secret, params.payload)
  return timingSafeEqual(expected, params.header)
}

type LineWebhookSource = {
  type?: string
  userId?: string
  groupId?: string
  roomId?: string
}

export type LineWebhookEvent = {
  type?: string
  mode?: string
  timestamp?: number
  webhookEventId?: string
  deliveryContext?: {
    isRedelivery?: boolean
  }
  source?: LineWebhookSource
  replyToken?: string
}

export type LineWebhookPayload = {
  destination?: string
  events?: LineWebhookEvent[]
}
