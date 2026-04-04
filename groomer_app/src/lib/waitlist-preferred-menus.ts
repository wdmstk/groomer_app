function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function decodePreferredMenus(value: string | null | undefined) {
  if (!value) return [] as string[]
  const raw = value
    .split(/\r?\n|,|、/)
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(raw)]
}

export function normalizePreferredMenuValues(values: unknown[]) {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
  return [...new Set(normalized)]
}

export function encodePreferredMenus(values: unknown[]) {
  const normalized = normalizePreferredMenuValues(values)
  if (normalized.length === 0) return null
  return normalized.join('\n')
}

export function matchPreferredMenu(preferredMenuValue: string | null | undefined, appointmentMenu: string) {
  const preferredMenus = decodePreferredMenus(preferredMenuValue)
  if (preferredMenus.length === 0) return true
  const normalizedAppointmentMenu = normalizeText(appointmentMenu)
  if (!normalizedAppointmentMenu) return false
  return preferredMenus.includes(normalizedAppointmentMenu)
}

export function formatPreferredMenusLabel(value: string | null | undefined) {
  const menus = decodePreferredMenus(value)
  if (menus.length === 0) return '未指定'
  return menus.join(' / ')
}
