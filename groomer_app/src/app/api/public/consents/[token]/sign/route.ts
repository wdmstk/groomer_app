import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { insertConsentAuditLogBestEffort } from '@/lib/consents/audit'
import {
  isConsentTokenExpired,
  validateConsentSignInput,
} from '@/lib/consents/sign-core'
import { signConsentWithDeps } from '@/lib/consents/sign-flow'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  CONSENT_PDF_BUCKET,
  CONSENT_SIGNATURE_BUCKET,
  decodeSignaturePng,
  hashConsentToken,
  noStoreHeaders,
  parseString,
} from '@/lib/consents/shared'
import { pickClientIpFromHeaders, toPrivacyHash } from '@/lib/privacy-hash'

type RouteParams = {
  params: Promise<{ token: string }>
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method Not Allowed. Use POST /api/public/consents/[token]/sign' },
    { status: 405, headers: noStoreHeaders() }
  )
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params
    const requestUrl = new URL(request.url)
    const appointmentId = parseString(requestUrl.searchParams.get('appointment_id'))
    const serviceName = parseString(requestUrl.searchParams.get('service_name'))
    const body = asObjectOrNull(await request.json().catch(() => null))
    const parsed = validateConsentSignInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400, headers: noStoreHeaders() })
    }
    const { signerName, signatureBase64, snsUsagePreference } = parsed

    const admin = createAdminSupabaseClient()
    const tokenHash = hashConsentToken(token)
    const { data: document, error: documentError } = await admin
      .from('consent_documents' as never)
      .select('id, store_id, customer_id, pet_id, template_version_id, status, token_expires_at')
      .eq('sign_token_hash', tokenHash)
      .maybeSingle()
    if (documentError) return NextResponse.json({ message: documentError.message }, { status: 500, headers: noStoreHeaders() })
    if (!document) return NextResponse.json({ message: 'document not found.' }, { status: 404, headers: noStoreHeaders() })
    if (document.status === 'signed') return NextResponse.json({ ok: true, reused: true }, { headers: noStoreHeaders() })
    if (isConsentTokenExpired(document.token_expires_at as string | null | undefined)) {
      return NextResponse.json({ message: 'token expired.' }, { status: 410, headers: noStoreHeaders() })
    }

    const signatureBuffer = decodeSignaturePng(signatureBase64)
    const ipHash = toPrivacyHash(pickClientIpFromHeaders(request.headers))
    const uaHash = toPrivacyHash(request.headers.get('user-agent'))

    const flow = await signConsentWithDeps({
      deps: {
      uploadSignature: async ({ path, bytes }) => {
        const { error } = await admin.storage
          .from(CONSENT_SIGNATURE_BUCKET)
          .upload(path, bytes, { contentType: 'image/png', upsert: false })
        if (error) {
          const message =
            error.message === 'Bucket not found'
              ? `Bucket not found: ${CONSENT_SIGNATURE_BUCKET}. Apply supabase_storage_consents.sql.`
              : error.message
          throw new Error(message)
        }
      },
      getTemplateVersion: async ({ templateVersionId }) => {
        const { data } = await admin
          .from('consent_template_versions' as never)
          .select('title, version_no, body_text')
          .eq('id', templateVersionId)
          .maybeSingle()
        return (data as { title: string | null; version_no: number | null; body_text: string | null } | null) ?? null
      },
      getCustomer: async ({ customerId }) => {
        const { data } = await admin
          .from('customers')
          .select('full_name, address, phone_number')
          .eq('id', customerId)
          .maybeSingle()
        return (data as { full_name: string | null; address: string | null; phone_number: string | null } | null) ?? null
      },
      getPet: async ({ petId }) => {
        const { data } = await admin
          .from('pets')
          .select('name, breed, gender, date_of_birth')
          .eq('id', petId)
          .maybeSingle()
        return (data as { name: string | null; breed: string | null; gender: string | null; date_of_birth: string | null } | null) ?? null
      },
      getStore: async ({ storeId }) => {
        const { data } = await admin.from('stores').select('name').eq('id', storeId).maybeSingle()
        return (data as { name: string | null } | null) ?? null
      },
      uploadPdf: async ({ path, bytes }) => {
        const { error } = await admin.storage
          .from(CONSENT_PDF_BUCKET)
          .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
        if (error) {
          const message =
            error.message === 'Bucket not found'
              ? `Bucket not found: ${CONSENT_PDF_BUCKET}. Apply supabase_storage_consents.sql.`
              : error.message
          throw new Error(message)
        }
      },
      insertSignature: async ({ payload }) => {
        const { error } = await admin.from('consent_signatures' as never).insert(payload as never)
        if (error) throw new Error(error.message)
      },
      updateDocumentAsSigned: async ({ documentId, signerName: signedName, signedAt, pdfPath }) => {
        const { error } = await admin
          .from('consent_documents' as never)
          .update({
            status: 'signed',
            signed_at: signedAt,
            signed_by_name: signedName,
            pdf_path: pdfPath,
            updated_at: signedAt,
            sign_token_hash: null,
          } as never)
          .eq('id', documentId)
        if (error) throw new Error(error.message)
      },
      insertAuditLog: async ({ storeId: sid, entityType, entityId, action, payload }) => {
        await insertConsentAuditLogBestEffort({
          supabase: admin,
          storeId: sid,
          entityType,
          entityId,
          action,
          before: {
            status: document.status,
            signed_at: null,
            signed_by_name: null,
          },
          after: {
            status: 'signed',
          },
          payload,
        })
      },
      createSignedPdfUrl: async ({ pdfPath, expiresSec }) => {
        const { data } = await admin.storage.from(CONSENT_PDF_BUCKET).createSignedUrl(pdfPath, expiresSec)
        return data?.signedUrl ?? null
      },
    },
      document: {
      id: String(document.id),
      store_id: String(document.store_id),
      customer_id: String(document.customer_id),
      pet_id: String(document.pet_id),
      template_version_id: String(document.template_version_id),
      status: String(document.status),
      token_expires_at: (document.token_expires_at as string | null) ?? null,
    },
      signerName,
      signatureBuffer,
      signatureStrokes: body.signature_strokes ?? [],
      ipHash,
      uaHash,
      deviceType: parseString(body.device_type),
      deviceOs: parseString(body.device_os),
      browser: parseString(body.browser),
      appointmentId,
      serviceName,
      snsUsagePreference,
    })

    return NextResponse.json({
      ok: true,
      document_id: flow.documentId,
      signed_at: flow.signedAt,
      pdf_url: flow.pdfUrl,
    }, { headers: noStoreHeaders() })
  } catch (error) {
    const message = error instanceof Error ? error.message : '署名処理に失敗しました。'
    return NextResponse.json({ message }, { status: 500, headers: noStoreHeaders() })
  }
}
