import type { Json } from '@/lib/supabase/database.types'
import type { UnknownObject } from '@/lib/object-utils'
import { buildSimpleConsentPdf } from '@/lib/consents/pdf'
import {
  formatConsentDateJst,
  formatPetAgeFromDateOfBirth,
  renderConsentTemplateText,
} from '@/lib/consents/template-render'
import {
  buildConsentPdfLines,
  buildConsentPdfPath,
  buildSignatureBlockLines,
  buildConsentSignaturePath,
  formatConsentBodyLines,
  splitConsentBodyAtSection12,
} from '@/lib/consents/sign-core'
import { createHash } from 'node:crypto'

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
  body_text: string | null
}

type SimpleNameRow = {
  full_name?: string | null
  address?: string | null
  phone_number?: string | null
  name?: string | null
  breed?: string | null
  gender?: string | null
  date_of_birth?: string | null
}

type StoreRow = {
  name: string | null
}

export type SignConsentDeps = {
  uploadSignature: (params: { path: string; bytes: Buffer }) => Promise<void>
  getTemplateVersion: (params: { templateVersionId: string }) => Promise<TemplateVersionRow | null>
  getCustomer: (params: { customerId: string }) => Promise<SimpleNameRow | null>
  getPet: (params: { petId: string }) => Promise<SimpleNameRow | null>
  getStore: (params: { storeId: string }) => Promise<StoreRow | null>
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
  appointmentId?: string | null
  serviceName?: string | null
  snsUsagePreference?: string | null
  nowIso?: string
}) {
  const nowIso = params.nowIso ?? new Date().toISOString()
  const signaturePath = buildConsentSignaturePath({
    storeId: params.document.store_id,
    documentId: params.document.id,
  })
  await params.deps.uploadSignature({ path: signaturePath, bytes: params.signatureBuffer })

  const [version, customer, pet, store] = await Promise.all([
    params.deps.getTemplateVersion({ templateVersionId: params.document.template_version_id }),
    params.deps.getCustomer({ customerId: params.document.customer_id }),
    params.deps.getPet({ petId: params.document.pet_id }),
    params.deps.getStore({ storeId: params.document.store_id }),
  ])

  const renderedBodyText = renderConsentTemplateText(String(version?.body_text ?? ''), {
    store_name: String(store?.name ?? ''),
    customer_name: String(customer?.full_name ?? 'ー'),
    customer_address: String(customer?.address ?? 'ー'),
    customer_phone: String(customer?.phone_number ?? 'ー'),
    pet_name: String(pet?.name ?? 'ー'),
    pet_species: 'ー',
    pet_breed: String(pet?.breed ?? 'ー'),
    pet_age: formatPetAgeFromDateOfBirth(
      typeof pet?.date_of_birth === 'string' ? pet.date_of_birth : null
    ) || 'ー',
    pet_gender: String(pet?.gender ?? 'ー'),
    service_name: params.serviceName ?? '',
    sns_usage_preference: params.snsUsagePreference ?? '',
    consent_date: formatConsentDateJst(new Date(nowIso)),
  })
  const signatureDigest = createHash('sha256').update(params.signatureBuffer).digest('hex')

  const pdfPath = buildConsentPdfPath({
    storeId: params.document.store_id,
    documentId: params.document.id,
  })
  const splitBody = splitConsentBodyAtSection12(renderedBodyText)
  const firstPageBodyLines = formatConsentBodyLines(splitBody.before12)
  const secondPageBodyLines = formatConsentBodyLines(splitBody.from12)
  const signatureBlockLines = buildSignatureBlockLines({
    signerName: params.signerName,
    signedAt: nowIso,
    signatureMethod: 'draw',
    signatureDigest,
    signaturePath,
  })
  const auditLines = buildConsentPdfLines({
    documentId: params.document.id,
    appointmentId: params.appointmentId ?? null,
    templateTitle: version?.title ?? null,
    versionNo: version?.version_no ?? null,
    customerName: customer?.full_name ?? null,
    petName: pet?.name ?? null,
    signerName: params.signerName,
    signedAt: nowIso,
    signatureMethod: 'draw',
    signatureDigest,
    signaturePath,
  })
  const pdfBuffer = buildSimpleConsentPdf({
    title: '施術同意書',
    lines: firstPageBodyLines,
    secondPageTitle: '施術同意書（電子署名）',
    secondPageLines: [
      ...secondPageBodyLines,
      '',
      ...signatureBlockLines,
    ],
    secondPageSignatureImagePng: params.signatureBuffer,
    thirdPageTitle: '施術同意書（監査情報）',
    thirdPageLines: auditLines.map((line) => (line ? `    ${line}` : '')),
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
      sns_usage_preference: params.snsUsagePreference ?? null,
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
