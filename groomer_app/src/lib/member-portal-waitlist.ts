type WaitlistChannel = 'manual' | 'line' | 'phone'

type WaitlistInput = {
  pet_id?: unknown
  preferred_menu?: unknown
  preferred_menus?: unknown
  preferred_staff_id?: unknown
  channel?: unknown
  desired_from?: unknown
  desired_to?: unknown
  notes?: unknown
}

export type NormalizedMemberPortalWaitlistInput = {
  pet_id: string | null
  preferred_menu: string | null
  preferred_staff_id: string | null
  channel: WaitlistChannel
  desired_from: string | null
  desired_to: string | null
  notes: string | null
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value)
  return text ? text : null
}

function normalizeChannel(value: unknown, fallback: WaitlistChannel): WaitlistChannel {
  const text = normalizeText(value)
  if (text === 'line' || text === 'phone') return text
  return fallback
}

function normalizePreferredMenus(values: unknown) {
  if (!Array.isArray(values)) return [] as string[]
  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
  return [...new Set(normalized)]
}

export function normalizeMemberPortalWaitlistInput(
  input: WaitlistInput,
  fallbackChannel: WaitlistChannel
): NormalizedMemberPortalWaitlistInput {
  const preferredMenus = normalizePreferredMenus(input.preferred_menus)
  const preferredMenuSingle = normalizeNullableText(input.preferred_menu)
  const preferredMenu = preferredMenus.length > 0 ? preferredMenus.join('\n') : preferredMenuSingle
  return {
    pet_id: normalizeNullableText(input.pet_id),
    preferred_menu: preferredMenu,
    preferred_staff_id: normalizeNullableText(input.preferred_staff_id),
    channel: normalizeChannel(input.channel, fallbackChannel),
    desired_from: normalizeNullableText(input.desired_from),
    desired_to: normalizeNullableText(input.desired_to),
    notes: normalizeNullableText(input.notes),
  }
}

export function validateMemberPortalWaitlistInput(input: NormalizedMemberPortalWaitlistInput) {
  if (!input.desired_from || !input.desired_to) return null
  const fromTime = new Date(input.desired_from).getTime()
  const toTime = new Date(input.desired_to).getTime()
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null
  if (fromTime > toTime) return '希望終了は希望開始以降で指定してください。'
  return null
}
