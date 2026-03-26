export function getConsentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'signed':
      return '署名済み'
    case 'sent':
      return '送信済み'
    case 'revoked':
      return '失効'
    case 'expired':
      return '期限切れ'
    case 'canceled':
      return '取消'
    case 'draft':
    default:
      return '下書き'
  }
}

export function getConsentStatusTone(status: string | null | undefined) {
  switch (status) {
    case 'signed':
      return 'bg-emerald-100 text-emerald-800'
    case 'sent':
      return 'bg-indigo-100 text-indigo-800'
    case 'revoked':
      return 'bg-rose-100 text-rose-800'
    case 'expired':
      return 'bg-amber-100 text-amber-900'
    case 'canceled':
      return 'bg-gray-200 text-gray-800'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function formatConsentDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return date.toLocaleString('ja-JP', { hour12: false })
}
