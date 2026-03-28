import {
  createConsentToken,
  hashConsentToken,
  parseIntWithMin,
  parseString,
} from '@/lib/consents/shared'
import type { UnknownObject } from '@/lib/object-utils'

export function validateConsentDocumentCreateInput(body: UnknownObject | null) {
  if (!body) return { ok: false as const, message: 'invalid json body.' }

  const customerId = parseString(body.customer_id)
  const petId = parseString(body.pet_id)
  const templateId = parseString(body.template_id)
  const requestedVersionId = parseString(body.template_version_id)
  const appointmentId = parseString(body.appointment_id)
  const serviceName = parseString(body.service_name)
  const deliveryChannel = parseString(body.delivery_channel) ?? 'in_person'
  const expiresInHours = parseIntWithMin(body.expires_in_hours, 1) ?? 72
  if (!customerId || !petId || !templateId) {
    return { ok: false as const, message: 'customer_id/pet_id/template_id are required.' }
  }

  return {
    ok: true as const,
    customerId,
    petId,
    templateId,
    requestedVersionId,
    appointmentId,
    serviceName,
    deliveryChannel,
    expiresInHours,
  }
}

export function resolveConsentVersionId(params: {
  requestedVersionId: string | null
  currentVersionId: string | null | undefined
}) {
  return params.requestedVersionId ?? params.currentVersionId ?? null
}

export function buildConsentDocumentSeed(params: {
  storeId: string
  customerId: string
  petId: string
  templateId: string
  versionId: string
  deliveryChannel: string
  expiresInHours: number
  actorUserId: string | null
  now?: Date
}) {
  const now = params.now ?? new Date()
  const token = createConsentToken()
  const tokenHash = hashConsentToken(token)
  const tokenExpiresAt = new Date(now.getTime() + params.expiresInHours * 60 * 60 * 1000).toISOString()
  const nextStatus = params.deliveryChannel === 'line' ? 'sent' : 'draft'

  return {
    token,
    tokenHash,
    tokenExpiresAt,
    nextStatus,
    insertPayload: {
      store_id: params.storeId,
      customer_id: params.customerId,
      pet_id: params.petId,
      template_id: params.templateId,
      template_version_id: params.versionId,
      status: nextStatus,
      delivery_channel: params.deliveryChannel,
      sign_token_hash: tokenHash,
      token_expires_at: tokenExpiresAt,
      created_by_user_id: params.actorUserId,
      updated_by_user_id: params.actorUserId,
    },
  }
}

export function buildConsentSignUrl(requestUrl: string, token: string) {
  return `${new URL(requestUrl).origin}/consent/sign/${token}`
}

export function buildConsentSignUrlWithServiceName(params: {
  requestUrl: string
  token: string
  serviceName?: string | null
  appointmentId?: string | null
}) {
  const url = new URL(`/consent/sign/${params.token}`, new URL(params.requestUrl).origin)
  if (params.serviceName?.trim()) {
    url.searchParams.set('service_name', params.serviceName.trim())
  }
  if (params.appointmentId?.trim()) {
    url.searchParams.set('appointment_id', params.appointmentId.trim())
  }
  return url.toString()
}

export function buildConsentLineMessage(params: {
  customerName: string | null | undefined
  signUrl: string
}) {
  return `${params.customerName ?? 'お客様'}様\n施術同意書へのご署名をお願いします。\n${params.signUrl}`
}
