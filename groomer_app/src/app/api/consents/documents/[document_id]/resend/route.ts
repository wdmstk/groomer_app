import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import { sendLineMessage } from '@/lib/line'
import { buildConsentSignUrlWithServiceName } from '@/lib/consents/documents-core'
import {
  createConsentToken,
  hashConsentToken,
  parseIntWithMin,
  parseString,
} from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{ document_id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { document_id: documentId } = await params
  const body = asObjectOrNull(await request.json().catch(() => ({})))
  const expiresInHours = parseIntWithMin(body?.expires_in_hours, 1) ?? 72
  const overrideChannel = parseString(body?.channel)
  const appointmentId = parseString(body?.appointment_id)
  const serviceName = parseString(body?.service_name)

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: document, error: documentError } = await supabase
    .from('consent_documents' as never)
    .select('id, status, customer_id, delivery_channel')
    .eq('store_id', storeId)
    .eq('id', documentId)
    .maybeSingle()
  if (documentError) return NextResponse.json({ message: documentError.message }, { status: 500 })
  if (!document) return NextResponse.json({ message: 'document not found.' }, { status: 404 })
  if (document.status === 'signed' || document.status === 'revoked') {
    return NextResponse.json({ message: `cannot resend in status=${document.status}` }, { status: 409 })
  }

  const token = createConsentToken()
  const tokenHash = hashConsentToken(token)
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
  const nextChannel = overrideChannel ?? (document.delivery_channel as string | null) ?? 'line'
  const signUrl = buildConsentSignUrlWithServiceName({
    requestUrl: request.url,
    token,
    appointmentId,
    serviceName,
  })

  const { error: updateError } = await supabase
    .from('consent_documents' as never)
    .update({
      sign_token_hash: tokenHash,
      token_expires_at: expiresAt,
      status: 'sent',
      delivery_channel: nextChannel,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('store_id', storeId)
    .eq('id', documentId)
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 })

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null
  if (nextChannel === 'line') {
    const { data: customer } = await supabase
      .from('customers')
      .select('line_id, full_name')
      .eq('store_id', storeId)
      .eq('id', document.customer_id)
      .maybeSingle()
    if (customer?.line_id) {
      const sendResult = await sendLineMessage({
        to: customer.line_id,
        messages: [{ type: 'text', text: `${customer.full_name ?? 'お客様'}様\n施術同意書へのご署名をお願いします。\n${signUrl}` }],
      })
      if (!sendResult.success) {
        status = 'failed'
        errorMessage = sendResult.error ?? 'line send failed'
      }
    } else {
      status = 'failed'
      errorMessage = 'customer line_id is not set'
    }
  }

  await supabase.from('consent_delivery_logs' as never).insert({
    store_id: storeId,
    document_id: documentId,
    channel: nextChannel,
    target: null,
    status,
    sent_at: new Date().toISOString(),
    error_message: errorMessage,
    payload: { sign_url: signUrl } as never,
  } as never)

  await insertConsentAuditLogBestEffort({
    supabase,
    storeId,
    entityType: 'document',
    entityId: documentId,
    action: status === 'sent' ? 'resent' : 'resend_failed',
    actorUserId: user?.id ?? null,
    before: document,
    after: {
      ...document,
      status: 'sent',
      delivery_channel: nextChannel,
      token_expires_at: expiresAt,
    },
    payload: {
      sign_url: signUrl,
      channel: nextChannel,
      delivery_status: status,
      error_message: errorMessage,
    },
  })

  return NextResponse.json({ ok: true, sign_url: signUrl, status })
}
