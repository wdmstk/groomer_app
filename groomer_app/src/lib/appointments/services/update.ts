import { estimateDurationMinutes } from '@/lib/appointments/duration'
import {
  getInitialReservationPaymentState,
  normalizeReservationPaymentMethod,
} from '@/lib/appointments/reservation-payment'
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
import type { Database } from '@/lib/supabase/database.types'
import { isObjectRecord } from '@/lib/object-utils'

function toOptionalStringFromUnknown(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function toOptionalStringFromForm(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

function asRecordOrNull(value: unknown): { [key: string]: unknown } | null {
  if (!isObjectRecord(value)) return null
  return value
}

export function normalizeUpdateAppointmentJsonInput(body: unknown): AppointmentWriteInput {
  const normalized = asRecordOrNull(body)
  const rawMenuIds = Array.isArray(normalized?.menu_ids) ? normalized.menu_ids : []
  return {
    customerId: toOptionalStringFromUnknown(normalized?.customer_id),
    petId: toOptionalStringFromUnknown(normalized?.pet_id),
    staffId: toOptionalStringFromUnknown(normalized?.staff_id),
    startTimeIso: toUtcIsoFromJstInput(toOptionalStringFromUnknown(normalized?.start_time)),
    endTimeIso: toUtcIsoFromJstInput(toOptionalStringFromUnknown(normalized?.end_time)),
    menuIds: rawMenuIds.map((value) => String(value)).filter(Boolean),
    status: toOptionalStringFromUnknown(normalized?.status),
    notes: toOptionalStringFromUnknown(normalized?.notes),
    reservationPaymentMethod: toOptionalStringFromUnknown(normalized?.reservation_payment_method),
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
    reservationPaymentMethod: toOptionalStringFromForm(formData.get('reservation_payment_method')) ?? 'none',
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
  const normalizedEndTimeIso = addMinutesToIso(input.startTimeIso!, estimatedDuration)

  const conflictCheck = await validateAppointmentConflict({
    supabase,
    storeId,
    staffId: input.staffId!,
    startTimeIso: input.startTimeIso!,
    endTimeIso: normalizedEndTimeIso,
    excludeAppointmentId: appointmentId,
  })
  if (!conflictCheck.ok) {
    throw new AppointmentServiceError(
      conflictCheck.message ?? '予約が競合しています。',
      409,
      { conflict: conflictCheck.conflict ?? null }
    )
  }

  const payload: Database['public']['Tables']['appointments']['Update'] = {
    customer_id: input.customerId!,
    pet_id: input.petId!,
    staff_id: input.staffId!,
    start_time: input.startTimeIso!,
    end_time: normalizedEndTimeIso,
    menu: summary.names,
    duration: estimatedDuration,
    status: input.status,
    notes: input.notes,
    store_id: storeId,
  }
  const reservationPaymentMethod = normalizeReservationPaymentMethod(input.reservationPaymentMethod)
  payload.reservation_payment_method = reservationPaymentMethod

  const { data: existingAppointment, error: existingError } = await supabase
    .from('appointments')
    .select(
      'id, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at'
    )
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .single()

  if (existingError) {
    throw new AppointmentServiceError(existingError.message, 500)
  }

  if (existingAppointment.reservation_payment_method !== reservationPaymentMethod) {
    const nextReservationPaymentState = getInitialReservationPaymentState(reservationPaymentMethod)
    payload.reservation_payment_status = nextReservationPaymentState.reservationPaymentStatus
    payload.reservation_payment_paid_at = nextReservationPaymentState.reservationPaymentPaidAt
    payload.reservation_payment_authorized_at = nextReservationPaymentState.reservationPaymentAuthorizedAt
  }

  if (input.status === '無断キャンセル') {
    const { data: paymentSettings } = await supabase
      .from('store_reservation_payment_settings')
      .select('no_show_charge_mode')
      .eq('store_id', storeId)
      .maybeSingle()

    if (paymentSettings?.no_show_charge_mode === 'auto') {
      if (reservationPaymentMethod === 'card_hold') {
        payload.reservation_payment_status = 'captured'
        payload.reservation_payment_paid_at = new Date().toISOString()
      } else if (
        reservationPaymentMethod === 'prepayment' &&
        (existingAppointment.reservation_payment_status === 'paid' ||
          existingAppointment.reservation_payment_status === 'captured')
      ) {
        payload.reservation_payment_status = 'paid'
        payload.reservation_payment_paid_at =
          existingAppointment.reservation_payment_paid_at ?? new Date().toISOString()
      } else if (reservationPaymentMethod === 'prepayment') {
        payload.reservation_payment_status = 'charge_pending'
      }
    }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(payload)
    .eq('id', appointmentId)
    .eq('store_id', storeId)
    .select(
      'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at'
    )
    .single()

  if (error) {
    throw new AppointmentServiceError(error.message, 500)
  }

  await syncAppointmentMenus(supabase, storeId, appointmentId, selectedMenus)
  return data
}
