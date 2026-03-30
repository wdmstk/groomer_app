function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export type ConsentTemplateVariables = {
  store_name?: string
  customer_name?: string
  customer_address?: string
  customer_phone?: string
  pet_name?: string
  pet_species?: string
  pet_breed?: string
  pet_age?: string
  pet_gender?: string
  service_name?: string
  sns_usage_preference?: string
  consent_date?: string
}

export function formatConsentDateJst(date: Date = new Date()) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function renderConsentTemplateText(template: string, vars: ConsentTemplateVariables) {
  return template.replace(PLACEHOLDER_PATTERN, (_, key: keyof ConsentTemplateVariables) => vars[key] ?? '')
}

export function renderConsentTemplateHtml(template: string, vars: ConsentTemplateVariables) {
  return template.replace(PLACEHOLDER_PATTERN, (_, key: keyof ConsentTemplateVariables) =>
    escapeHtml(vars[key] ?? '')
  )
}

export function formatPetAgeFromDateOfBirth(value: string | null | undefined, now: Date = new Date()) {
  if (!value) return ''
  const birthDate = new Date(value)
  if (!Number.isFinite(birthDate.getTime())) return ''
  const yearDiff = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  const totalMonths = yearDiff * 12 + monthDiff - (now.getDate() < birthDate.getDate() ? 1 : 0)
  if (totalMonths < 0) return ''
  if (totalMonths < 12) return `${Math.max(totalMonths, 0)}ヶ月`
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return months > 0 ? `${years}歳${months}ヶ月` : `${years}歳`
}
