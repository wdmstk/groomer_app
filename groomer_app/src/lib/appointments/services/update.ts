import { estimateDurationMinutes } from '@/lib/appointments/duration'
import { validateAppointmentConflict } from '@/lib/appointments/conflict'
import {
  AppointmentServiceError,
  type AppointmentSupabaseClient,
  type AppointmentWriteInput,
  assertAppointmentStoreConsistency,
  calculateMenuSummary,
  fetchSelectedMenus,
  syncAppointmentMenus,
  toUtcIsoFromJstInput,
  validateAppointmentWriteInput,
} from '@/lib/appointments/services/shared'

function toOptionalStringFromUnknown(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function toOptionalStringFromForm(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

export function normalizeUpdateAppointmentJsonInput(body: Record<string, unknown> | null): AppointmentWriteInput {
  const rawMenuIds = Array.isArray(body?.menu_ids) ? body?.menu_ids : []
  return {
    customerId: toOptionalStringFromUnknown(body?.customer_id),
    petId: toOptionalStringFromUnknown(body?.pet_id),
    staffId: toOptionalStringFromUnknown(body?.staff_id),
    startTimeIso: toUtcIsoFromJstInput(toOptionalStringFromUnknown(body?.start_time)),
    endTimeIso: toUtcIsoFromJstInput(toOptionalStringFromUnknown(body?.end_time)),
    menuIds: rawMenuIds.map((value) => String(value)).filter(Boolean),
    status: toOptionalStringFromUnknown(body?.status),
    notes: toOptionalStringFromUnknown(body?.notes),
  }
}

export function normalizeUpdateAppointmentFormInput(formData: FormData): AppointmentWriteInput {
  return {
    customerId: toOptionalStringFromForm(formData.get('customer_id')),
    petId: toOptionalStringFromForm(formData.get('pet_id')),
    staffId: toOptionalStringFromForm(formData.get('staff_id')),
    startTimeIso: toUtcIsoFromJstInput(toOptionalStringFromForm(formData.get('start_time'))),
    endTimeIso: toUtcIsoFromJstInput(toOptionalStringFromForm(formData.get('end_time'))),
    menuIds: formData.getAll('menu_ids').map((value) => value.toString()).filter(Boolean),
    status: toOptionalStringFromForm(formData.get('status')) ?? '予約済',
    notes: toOptionalStringFromForm(formData.get('notes')),
  }
}

export async function updateAppointment(params: {
  supabase: AppointmentSupabaseClient
  storeId: string
  appointmentId: string
  input: AppointmentWriteInput
}) {
  const { supabase, storeId, appointmentId, input } = params
  validateAppointmentWriteInput(input)
  await assertAppointmentStoreConsistency(supabase, storeId, input)

  const selectedMenus = await fetchSelectedMenus(supabase, storeId, input.menuIds)
  const summary = calculateMenuSummary(selectedMenus)
  const estimatedDuration = await estimateDurationMinutes({
    supabase,
    storeId,
    petId: input.petId!,
    staffId: input.staffId!,
    menus: selectedMenus.map((menu) => ({ id: menu.id, duration: menu.duration })),
  })

  const conflictCheck = await validateAppointmentConflict({
    supabase,
    storeId,
    staffId: input.staffId!,
    startTimeIso: input.startTimeIso!,
    endTimeIso: input.endTimeIso!,
    excludeAppointmentId: appointmentId,
  })
  if (!conflictCheck.ok) {
    throw new AppointmentServiceError(
      conflictCheck.message ?? '予約が競合しています。',
      409,
      { conflict: conflictCheck.conflict ?? null }
    )
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      customer_id: input.customerId,
      pet_id: input.petId,
      staff_id: input.staffId,
      start_time: input.startTimeIso,
      end_time: input.endTimeIso,
      menu: summary.names,
      duration: estimatedDuration,
      status: input.status,
      notes: input.notes,
      store_id: storeId,
    })
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .select('id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes')
    .single()

  if (error) {
    throw new AppointmentServiceError(error.message, 500)
  }

  await syncAppointmentMenus(supabase, storeId, appointmentId, selectedMenus)
  return data
}
