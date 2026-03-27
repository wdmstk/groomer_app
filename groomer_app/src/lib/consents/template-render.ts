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
  pet_name?: string
  service_name?: string
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
