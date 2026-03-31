import type { Json } from '@/lib/supabase/database.types'
import type { UnknownObject } from '@/lib/object-utils'
import { buildConsentDocumentSeed, buildConsentLineMessage, buildConsentSignUrlWithServiceName } from '@/lib/consents/documents-core'

type InsertedDocumentRow = {
  id: string
  status: string
  token_expires_at: string
}

type CustomerRow = {
  line_id: string | null
  full_name: string | null
}

export type CreateConsentDocumentDeps = {
  insertDocument: (params: { payload: UnknownObject }) => Promise<InsertedDocumentRow>
  getCustomer: (params: { storeId: string; customerId: string }) => Promise<CustomerRow | null>
  sendLineMessage: (params: { to: string; text: string }) => Promise<{ success: boolean; error?: string | null }>
  insertDeliveryLog: (params: {
    storeId: string
    documentId: string
    channel: string
    target: string | null
    status: 'sent' | 'failed'
    errorMessage: string | null
    payload: Json
  }) => Promise<void>
  insertAuditLog: (params: {
    storeId: string
    entityType: 'document' | 'delivery'
    entityId: string
    action: string
    actorUserId: string | null
    after?: UnknownObject
    payload?: Json
  }) => Promise<void>
}

export async function createConsentDocumentWithDeps(params: {
  deps: CreateConsentDocumentDeps
  storeId: string
  actorUserId: string | null
  requestUrl: string
  customerId: string
  petId: string
  templateId: string
  versionId: string
  appointmentId?: string | null
  deliveryChannel: string
  expiresInHours: number
  serviceName?: string | null
  snsUsagePreference?: string | null
}) {
  const seed = buildConsentDocumentSeed({
    storeId: params.storeId,
    customerId: params.customerId,
    petId: params.petId,
    templateId: params.templateId,
    versionId: params.versionId,
    appointmentId: params.appointmentId,
    deliveryChannel: params.deliveryChannel,
    expiresInHours: params.expiresInHours,
    actorUserId: params.actorUserId,
  })

  const inserted = await params.deps.insertDocument({ payload: seed.insertPayload })
  await params.deps.insertAuditLog({
    storeId: params.storeId,
    entityType: 'document',
    entityId: inserted.id,
    action: 'created',
    actorUserId: params.actorUserId,
    after: {
      ...inserted,
      customer_id: params.customerId,
      pet_id: params.petId,
      template_id: params.templateId,
      template_version_id: params.versionId,
      appointment_id: params.appointmentId ?? null,
      delivery_channel: params.deliveryChannel,
    },
  })

  const signUrl = buildConsentSignUrlWithServiceName({
    requestUrl: params.requestUrl,
    token: seed.token,
    serviceName: params.serviceName,
    appointmentId: params.appointmentId,
    snsUsagePreference: params.snsUsagePreference,
  })

  if (params.deliveryChannel === 'line') {
    const customer = await params.deps.getCustomer({
      storeId: params.storeId,
      customerId: params.customerId,
    })
    const lineId = customer?.line_id ?? null
    if (lineId) {
      const bodyText = buildConsentLineMessage({
        customerName: customer?.full_name ?? null,
        signUrl,
      })
      const sendResult = await params.deps.sendLineMessage({ to: lineId, text: bodyText })
      await params.deps.insertDeliveryLog({
        storeId: params.storeId,
        documentId: inserted.id,
        channel: 'line',
        target: lineId,
        status: sendResult.success ? 'sent' : 'failed',
        errorMessage: sendResult.success ? null : sendResult.error ?? null,
        payload: { sign_url: signUrl } as Json,
      })
      await params.deps.insertAuditLog({
        storeId: params.storeId,
        entityType: 'delivery',
        entityId: inserted.id,
        action: sendResult.success ? 'sent' : 'send_failed',
        actorUserId: params.actorUserId,
        payload: {
          channel: 'line',
          target: lineId,
          sign_url: signUrl,
          error_message: sendResult.success ? null : sendResult.error ?? null,
        } as Json,
      })
    }
  }

  return {
    inserted,
    signUrl,
  }
}
