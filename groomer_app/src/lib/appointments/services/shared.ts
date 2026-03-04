import type { createStoreScopedClient } from '@/lib/supabase/store'

export class AppointmentServiceError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'AppointmentServiceError'
    this.status = status
    this.details = details
  }
}

export type AppointmentSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export type MenuSnapshot = {
  id: string
  name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
}

export type AppointmentWriteInput = {
  customerId: string | null
  petId: string | null
  staffId: string | null
  startTimeIso: string | null
  endTimeIso: string | null
  menuIds: string[]
  status: string | null
  notes: string | null
}

export function toUtcIsoFromJstInput(value: string | null | undefined) {
  if (!value) return null
  const source = /Z|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}:00+09:00`
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function calculateMenuSummary(menus: MenuSnapshot[]) {
  const names = menus.map((menu) => menu.name).join(' / ')
  const duration = menus.reduce((total, menu) => total + menu.duration, 0)
  return { names, duration }
}

export function validateAppointmentWriteInput(input: AppointmentWriteInput) {
  if (!input.customerId) throw new AppointmentServiceError('顧客の選択は必須です。')
  if (!input.petId) throw new AppointmentServiceError('ペットの選択は必須です。')
  if (!input.staffId) throw new AppointmentServiceError('担当スタッフの選択は必須です。')
  if (!input.startTimeIso || !input.endTimeIso) {
    throw new AppointmentServiceError('予約日時は必須です。')
  }
  if (input.menuIds.length === 0) {
    throw new AppointmentServiceError('予約メニューの選択は必須です。')
  }
}

export async function assertAppointmentStoreConsistency(
  supabase: AppointmentSupabaseClient,
  storeId: string,
  input: AppointmentWriteInput
) {
  const [customerCheck, petCheck, staffCheck] = await Promise.all([
    supabase.from('customers').select('id').eq('id', input.customerId).eq('store_id', storeId).maybeSingle(),
    supabase.from('pets').select('id').eq('id', input.petId).eq('store_id', storeId).maybeSingle(),
    supabase.from('staffs').select('id').eq('id', input.staffId).eq('store_id', storeId).maybeSingle(),
  ])

  if (!customerCheck.data || !petCheck.data || !staffCheck.data) {
    throw new AppointmentServiceError('顧客・ペット・担当の店舗整合性が不正です。')
  }
}

export async function fetchSelectedMenus(
  supabase: AppointmentSupabaseClient,
  storeId: string,
  menuIds: string[]
) {
  const { data: menuRows, error: menuError } = await supabase
    .from('service_menus')
    .select('id, name, price, duration, tax_rate, tax_included')
    .in('id', menuIds)
    .eq('store_id', storeId)

  if (menuError) {
    throw new AppointmentServiceError(menuError.message, 500)
  }

  const selectedMenus = (menuRows ?? []) as MenuSnapshot[]
  if (selectedMenus.length === 0) {
    throw new AppointmentServiceError('有効なメニューが見つかりません。')
  }

  return selectedMenus
}

export async function syncAppointmentMenus(
  supabase: AppointmentSupabaseClient,
  storeId: string,
  appointmentId: string,
  selectedMenus: MenuSnapshot[]
) {
  const { error: deleteError } = await supabase
    .from('appointment_menus')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('store_id', storeId)

  if (deleteError) {
    throw new AppointmentServiceError(deleteError.message, 500)
  }

  const menuPayload = selectedMenus.map((menu) => ({
    store_id: storeId,
    appointment_id: appointmentId,
    menu_id: menu.id,
    menu_name: menu.name,
    price: menu.price,
    duration: menu.duration,
    tax_rate: menu.tax_rate ?? 0.1,
    tax_included: menu.tax_included ?? true,
  }))

  const { error: menuInsertError } = await supabase.from('appointment_menus').insert(menuPayload)
  if (menuInsertError) {
    throw new AppointmentServiceError(menuInsertError.message, 500)
  }
}
