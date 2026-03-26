import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import {
  resolveConsentVersionId,
  validateConsentDocumentCreateInput,
} from '@/lib/consents/documents-core'
import { createConsentDocumentWithDeps } from '@/lib/consents/documents-flow'
import { sendLineMessage } from '@/lib/line'
import { parseString } from '@/lib/consents/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'

export async function GET(request: Request) {
  const { supabase, storeId } = await createStoreScopedClient()
  const url = new URL(request.url)
  const customerId = parseString(url.searchParams.get('customer_id'))
  const petId = parseString(url.searchParams.get('pet_id'))
  const status = parseString(url.searchParams.get('status'))

  let query = supabase
    .from('consent_documents' as never)
    .select(
      'id, customer_id, pet_id, template_id, template_version_id, status, delivery_channel, signed_at, signed_by_name, expires_at, created_at, pdf_path'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (petId) query = query.eq('pet_id', petId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}

export async function POST(request: Request) {
  const body = asObjectOrNull(await request.json().catch(() => null))
  const parsed = validateConsentDocumentCreateInput(body)
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 })
  const { customerId, petId, templateId, requestedVersionId, deliveryChannel, expiresInHours } = parsed

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: template, error: templateError } = await supabase
    .from('consent_templates' as never)
    .select('id, current_version_id, status')
    .eq('store_id', storeId)
    .eq('id', templateId)
    .maybeSingle()
  if (templateError) return NextResponse.json({ message: templateError.message }, { status: 500 })
  if (!template) return NextResponse.json({ message: 'template not found.' }, { status: 404 })

  const versionId = resolveConsentVersionId({
    requestedVersionId,
    currentVersionId: template.current_version_id as string | null,
  })
  if (!versionId) return NextResponse.json({ message: 'template version is missing.' }, { status: 409 })

  const { data: version, error: versionError } = await supabase
    .from('consent_template_versions' as never)
    .select('id')
    .eq('store_id', storeId)
    .eq('template_id', templateId)
    .eq('id', versionId)
    .maybeSingle()
  if (versionError) return NextResponse.json({ message: versionError.message }, { status: 500 })
  if (!version) return NextResponse.json({ message: 'template version not found.' }, { status: 404 })

  const { inserted, signUrl } = await createConsentDocumentWithDeps({
    deps: {
      insertDocument: async ({ payload }) => {
        const { data, error: insertError } = await supabase
          .from('consent_documents' as never)
          .insert(payload as never)
          .select('id, status, token_expires_at')
          .single()
        if (insertError || !data) throw new Error(insertError?.message ?? 'failed to create document.')
        return data as { id: string; status: string; token_expires_at: string }
      },
      getCustomer: async ({ storeId: sid, customerId: cid }) => {
        const { data: customer } = await supabase
          .from('customers')
          .select('line_id, full_name')
          .eq('store_id', sid)
          .eq('id', cid)
          .maybeSingle()
        return (customer as { line_id: string | null; full_name: string | null } | null) ?? null
      },
      sendLineMessage: async ({ to, text }) =>
        sendLineMessage({
          to,
          messages: [{ type: 'text', text }],
        }),
      insertDeliveryLog: async ({ storeId: sid, documentId, channel, target, status, errorMessage, payload }) => {
        await supabase.from('consent_delivery_logs' as never).insert({
          store_id: sid,
          document_id: documentId,
          channel,
          target,
          status,
          sent_at: new Date().toISOString(),
          error_message: errorMessage,
          payload: payload as never,
        } as never)
      },
      insertAuditLog: async ({ storeId: sid, entityType, entityId, action, actorUserId, after, payload }) => {
        await insertConsentAuditLogBestEffort({
          supabase,
          storeId: sid,
          entityType,
          entityId,
          action,
          actorUserId,
          after,
          payload,
        })
      },
    },
    storeId,
    actorUserId: user?.id ?? null,
    requestUrl: request.url,
    customerId,
    petId,
    templateId,
    versionId,
    deliveryChannel,
    expiresInHours,
  })

  return NextResponse.json({
    ok: true,
    document: inserted,
    sign_url: signUrl,
  }, { status: 201 })
}
