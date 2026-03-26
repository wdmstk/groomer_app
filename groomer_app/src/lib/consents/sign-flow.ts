import type { Json } from '@/lib/supabase/database.types'
import type { UnknownObject } from '@/lib/object-utils'
import { buildSimpleConsentPdf } from '@/lib/consents/pdf'
import { buildConsentPdfLines, buildConsentPdfPath, buildConsentSignaturePath } from '@/lib/consents/sign-core'

type ConsentDocumentRow = {
  id: string
  store_id: string
  customer_id: string
  pet_id: string
  template_version_id: string
  status: string
  token_expires_at: string | null
}

type TemplateVersionRow = {
  title: string | null
  version_no: number | null
}

type SimpleNameRow = {
  full_name?: string | null
  name?: string | null
}

export type SignConsentDeps = {
  uploadSignature: (params: { path: string; bytes: Buffer }) => Promise<void>
  getTemplateVersion: (params: { templateVersionId: string }) => Promise<TemplateVersionRow | null>
  getCustomer: (params: { customerId: string }) => Promise<SimpleNameRow | null>
  getPet: (params: { petId: string }) => Promise<SimpleNameRow | null>
  uploadPdf: (params: { path: string; bytes: Buffer }) => Promise<void>
  insertSignature: (params: { payload: UnknownObject }) => Promise<void>
  updateDocumentAsSigned: (params: {
    documentId: string
    signerName: string
    signedAt: string
    pdfPath: string
  }) => Promise<void>
  insertAuditLog: (params: {
    storeId: string
    entityType: 'document'
    entityId: string
    action: 'signed'
    payload: Json
  }) => Promise<void>
  createSignedPdfUrl: (params: { pdfPath: string; expiresSec: number }) => Promise<string | null>
}

export async function signConsentWithDeps(params: {
  deps: SignConsentDeps
  document: ConsentDocumentRow
  signerName: string
  signatureBuffer: Buffer
  signatureStrokes: unknown
  ipHash: string | null
  uaHash: string | null
  deviceType: string | null
  deviceOs: string | null
  browser: string | null
  nowIso?: string
}) {
  const nowIso = params.nowIso ?? new Date().toISOString()
  const signaturePath = buildConsentSignaturePath({
    storeId: params.document.store_id,
    documentId: params.document.id,
  })
  await params.deps.uploadSignature({ path: signaturePath, bytes: params.signatureBuffer })

  const [version, customer, pet] = await Promise.all([
    params.deps.getTemplateVersion({ templateVersionId: params.document.template_version_id }),
    params.deps.getCustomer({ customerId: params.document.customer_id }),
    params.deps.getPet({ petId: params.document.pet_id }),
  ])

  const pdfPath = buildConsentPdfPath({
    storeId: params.document.store_id,
    documentId: params.document.id,
  })
  const pdfBuffer = buildSimpleConsentPdf({
    title: `施術同意書: ${version?.title ?? '同意書'}`,
    lines: buildConsentPdfLines({
      documentId: params.document.id,
      versionNo: version?.version_no ?? null,
      customerName: customer?.full_name ?? null,
      petName: pet?.name ?? null,
      signerName: params.signerName,
      signedAt: nowIso,
      signaturePath,
    }),
  })
  await params.deps.uploadPdf({ path: pdfPath, bytes: pdfBuffer })

  await params.deps.insertSignature({
    payload: {
      store_id: params.document.store_id,
      document_id: params.document.id,
      signer_name: params.signerName,
      signature_image_path: signaturePath,
      signature_strokes: params.signatureStrokes,
      consent_checked: true,
      signed_at: nowIso,
      ip_hash: params.ipHash,
      ua_hash: params.uaHash,
      device_type: params.deviceType,
      device_os: params.deviceOs,
      browser: params.browser,
    },
  })

  await params.deps.updateDocumentAsSigned({
    documentId: params.document.id,
    signerName: params.signerName,
    signedAt: nowIso,
    pdfPath,
  })

  await params.deps.insertAuditLog({
    storeId: params.document.store_id,
    entityType: 'document',
    entityId: params.document.id,
    action: 'signed',
    payload: {
      signer_name: params.signerName,
      signature_path: signaturePath,
      ip_hash: params.ipHash,
      ua_hash: params.uaHash,
    } as Json,
  })

  const signedPdfUrl = await params.deps.createSignedPdfUrl({
    pdfPath,
    expiresSec: 60 * 10,
  })

  return {
    documentId: params.document.id,
    signedAt: nowIso,
    pdfPath,
    signaturePath,
    pdfUrl: signedPdfUrl,
  }
}
