import { parseString } from '@/lib/consents/shared'
import type { UnknownObject } from '@/lib/object-utils'

export function validateConsentSignInput(body: UnknownObject | null) {
  if (!body) return { ok: false as const, message: 'invalid json body.' }

  const signerName = parseString(body.signer_name)
  const signatureBase64 = parseString(body.signature_image_base64)
  const snsUsagePreference = parseString(body.sns_usage_preference)
  const consentChecked = body.consent_checked === true
  if (!signerName || !signatureBase64 || !consentChecked) {
    return { ok: false as const, message: 'signer_name/signature/consent_checked are required.' }
  }

  const normalizedSnsUsagePreference =
    snsUsagePreference === '許可する' || snsUsagePreference === 'ペットのみなら許可'
      ? snsUsagePreference
      : '許可しない'

  return {
    ok: true as const,
    signerName,
    signatureBase64,
    snsUsagePreference: normalizedSnsUsagePreference,
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
  const fallback = (value: string | null | undefined) => (value && value.trim() ? value : 'ー')
  const block = (label: string, value: string) => [`${label}:`, `  ${value}`, '']
  return [
    ...block('Document ID', params.documentId),
    ...block('Appointment ID', fallback(params.appointmentId)),
    ...block('Template', fallback(params.templateTitle)),
    ...block('Version', fallback(String(params.versionNo ?? ''))),
    ...block('Customer', fallback(params.customerName)),
    ...block('Pet', fallback(params.petName)),
    ...block('Signer', params.signerName),
    ...block('Signed At', params.signedAt),
    ...block('Signature Method', params.signatureMethod),
    ...block('Signature Digest (sha256)', params.signatureDigest),
    ...block('Signature Path', params.signaturePath),
  ]
}

export function formatConsentBodyLines(consentBodyText: string) {
  const headingPattern = /^\d+\.\s/
  const dashListPattern = /^[-・]\s*/
  const bodyLines = consentBodyText
    .split('\n')
    .map((line) => line.trimEnd())

  return bodyLines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (headingPattern.test(trimmed)) return `  ${trimmed}`
    if (dashListPattern.test(trimmed)) return `      ・ ${trimmed.replace(dashListPattern, '')}`
    return `    ${trimmed}`
  })
}

export function splitConsentBodyAtSection12(consentBodyText: string) {
  const lines = consentBodyText.split('\n')
  const section12Index = lines.findIndex((line) => /^\s*12\.\s/.test(line))
  if (section12Index < 0) {
    return { before12: consentBodyText, from12: '' }
  }
  return {
    before12: lines.slice(0, section12Index).join('\n'),
    from12: lines.slice(section12Index).join('\n'),
  }
}

export function buildSignatureBlockLines(params: {
  signerName: string
  signedAt: string
  signatureMethod: 'draw' | 'typed'
  signatureDigest?: string
  signaturePath?: string
}) {
  const fallback = (value: string | null | undefined) => (value && value.trim() ? value : 'ー')
  const block = (label: string, value: string) => [`    ${label}:`, `      ${value}`]
  return [
    '  【電子署名】',
    ...block('署名者', fallback(params.signerName)),
    ...block('署名日時', fallback(params.signedAt)),
    ...block('署名方式', params.signatureMethod),
    ...block('署名ダイジェスト', fallback(params.signatureDigest)),
    ...block('署名データ保存先', fallback(params.signaturePath)),
  ]
}
