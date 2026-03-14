import { asObject } from '@/lib/object-utils'

export class PublicReservationServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PublicReservationServiceError'
    this.status = status
  }
}

export type PublicReservationMenuSnapshot = {
  id: string
  name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_instant_bookable?: boolean | null
}

export type PublicReservationInput = {
  customerName: string
  phoneNumber: string
  email: string
  petName: string
  petBreed: string
  petGender: string
  preferredStart: string
  notes: string
  qrPayloadText: string
  menuIds: string[]
  memberPortalToken?: string
  preferredStaffId?: string
}

export function toUtcIsoFromJstInput(value: string) {
  const source = /Z|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}:00+09:00`
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso)
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString()
}

export function calculateMenuSummary(menus: PublicReservationMenuSnapshot[]) {
  const names = menus.map((menu) => menu.name).join(' / ')
  const duration = menus.reduce((total, menu) => total + menu.duration, 0)
  return { names, duration }
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase()
}

export function normalizePublicReservationInput(body: unknown): PublicReservationInput {
  const source = asObject(body)
  return {
    customerName: typeof source.customerName === 'string' ? source.customerName.trim() : '',
    phoneNumber: typeof source.phoneNumber === 'string' ? source.phoneNumber.trim() : '',
    email: typeof source.email === 'string' ? source.email.trim() : '',
    petName: typeof source.petName === 'string' ? source.petName.trim() : '',
    petBreed: typeof source.petBreed === 'string' ? source.petBreed.trim() : '',
    petGender: typeof source.petGender === 'string' ? source.petGender.trim() : '',
    preferredStart: typeof source.preferredStart === 'string' ? source.preferredStart.trim() : '',
    notes: typeof source.notes === 'string' ? source.notes.trim() : '',
    qrPayloadText: typeof source.qrPayload === 'string' ? source.qrPayload.trim() : '',
    menuIds: Array.isArray(source.menuIds) ? source.menuIds.map((id) => String(id)).filter(Boolean) : [],
    memberPortalToken:
      typeof source.memberPortalToken === 'string' ? source.memberPortalToken.trim() : '',
    preferredStaffId:
      typeof source.preferredStaffId === 'string' ? source.preferredStaffId.trim() : '',
  }
}

export function normalizeQrLookupInput(body: unknown) {
  const source = asObject(body)
  return {
    qrPayloadText: typeof source.qrPayload === 'string' ? source.qrPayload.trim() : '',
  }
}

export function validatePublicReservationInput(input: PublicReservationInput) {
  if (!input.customerName || !input.petName || !input.preferredStart) {
    throw new PublicReservationServiceError('必須項目を入力してください。')
  }
  if (input.menuIds.length === 0) {
    throw new PublicReservationServiceError('施術メニューを1つ以上選択してください。')
  }
}
