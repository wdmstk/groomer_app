import { estimateDurationMinutes } from '@/lib/appointments/duration'
import { validateAppointmentConflict } from '@/lib/appointments/conflict'
import {
  addMinutesToIso,
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

function toOptionalString(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

export function normalizeCreateAppointmentInput(formData: FormData): AppointmentWriteInput {
  return {
    customerId: toOptionalString(formData.get('customer_id')),
    petId: toOptionalString(formData.get('pet_id')),
    staffId: toOptionalString(formData.get('staff_id')),
    startTimeIso: toUtcIsoFromJstInput(toOptionalString(formData.get('start_time'))),
    endTimeIso: toUtcIsoFromJstInput(toOptionalString(formData.get('end_time'))),
    menuIds: formData.getAll('menu_ids').map((value) => value.toString()).filter(Boolean),
    status: toOptionalString(formData.get('status')) ?? '予約済',
    notes: toOptionalString(formData.get('notes')),
  }
}

export async function createAppointment(params: {
  supabase: AppointmentSupabaseClient
  storeId: string
  input: AppointmentWriteInput
}) {
  const { supabase, storeId, input } = params
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
  const normalizedEndTimeIso = addMinutesToIso(input.startTimeIso!, estimatedDuration)

  const conflictCheck = await validateAppointmentConflict({
    supabase,
    storeId,
    staffId: input.staffId!,
    startTimeIso: input.startTimeIso!,
    endTimeIso: normalizedEndTimeIso,
  })
  if (!conflictCheck.ok) {
    throw new AppointmentServiceError(
      conflictCheck.message ?? '予約が競合しています。',
      409,
      { conflict: conflictCheck.conflict ?? null }
    )
  }

  const payload = {
    store_id: storeId,
    customer_id: input.customerId,
    pet_id: input.petId,
    staff_id: input.staffId,
    start_time: input.startTimeIso,
    end_time: normalizedEndTimeIso,
    menu: summary.names,
    duration: estimatedDuration,
    status: input.status ?? '予約済',
    notes: input.notes,
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new AppointmentServiceError(error.message, 500)
  }

  const appointmentId = appointment?.id
  if (!appointmentId) {
    throw new AppointmentServiceError('予約IDが取得できません。', 500)
  }

  await syncAppointmentMenus(supabase, storeId, appointmentId, selectedMenus)
  return { id: appointmentId }
}
