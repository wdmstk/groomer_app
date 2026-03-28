import { parseString } from '@/lib/consents/shared'
import type { UnknownObject } from '@/lib/object-utils'

export function validateConsentSignInput(body: UnknownObject | null) {
  if (!body) return { ok: false as const, message: 'invalid json body.' }

  const signerName = parseString(body.signer_name)
  const signatureBase64 = parseString(body.signature_image_base64)
  const consentChecked = body.consent_checked === true
  if (!signerName || !signatureBase64 || !consentChecked) {
    return { ok: false as const, message: 'signer_name/signature/consent_checked are required.' }
  }

  return {
    ok: true as const,
    signerName,
    signatureBase64,
  }
}

export function isConsentTokenExpired(tokenExpiresAt: string | null | undefined, nowMs = Date.now()) {
  if (!tokenExpiresAt) return false
  return new Date(tokenExpiresAt).getTime() < nowMs
}

export function buildConsentSignaturePath(params: {
  storeId: string
  documentId: string
  nowMs?: number
}) {
  const nowMs = params.nowMs ?? Date.now()
  return `${params.storeId}/consents/signatures/${params.documentId}-${nowMs}.png`
}

export function buildConsentPdfPath(params: { storeId: string; documentId: string }) {
  return `${params.storeId}/consents/pdfs/${params.documentId}.pdf`
}

export function buildConsentPdfLines(params: {
  documentId: string
  appointmentId?: string | null
  templateTitle?: string | null
  versionNo: number | string | null | undefined
  customerName: string | null | undefined
  petName: string | null | undefined
  signerName: string
  signedAt: string
  signatureMethod: 'draw' | 'typed'
  signatureDigest: string
  signaturePath: string
}) {
  return [
    `Document ID: ${params.documentId}`,
    `Appointment ID: ${params.appointmentId ?? '-'}`,
    `Template: ${params.templateTitle ?? '-'}`,
    `Version: ${params.versionNo ?? '-'}`,
    `Customer: ${params.customerName ?? '-'}`,
    `Pet: ${params.petName ?? '-'}`,
    `Signer: ${params.signerName}`,
    `Signed At: ${params.signedAt}`,
    `Signature Method: ${params.signatureMethod}`,
    `Signature Digest (sha256): ${params.signatureDigest}`,
    `Signature Path: ${params.signaturePath}`,
  ]
}

export function buildConsentPrintableLines(params: {
  customerName: string | null | undefined
  petName: string | null | undefined
  signerName: string
  signedAt: string
  signatureMethod: 'draw' | 'typed'
  consentBodyText: string
}) {
  const bodyLines = params.consentBodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => [`  ${line}`, ''])

  return [
    `顧客: ${params.customerName ?? '-'}`,
    `ペット: ${params.petName ?? '-'}`,
    '',
    '【施術同意書 本文】',
    '',
    ...bodyLines,
    '【電子署名】',
    `  署名者: ${params.signerName}`,
    `  署名日時: ${params.signedAt}`,
    `  署名方式: ${params.signatureMethod}`,
  ]
}
