import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import {
  ACTIVE_STAY_STATUSES,
  buildStayItemSnapshots,
  deriveTransportFlagsFromSelections,
  parseSelectedStayItems,
  sumStayItemAmount,
  type HotelMenuItemRow,
} from '@/lib/hotel/stay-items'
import { asObjectOrNull } from '@/lib/object-utils'
import { deriveNightsByPlannedRange, parseIsoDateTime, parseNights, parseOptionalDate, parseOptionalString, parseStatus } from '@/lib/hotel/stays'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireStoreContext() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membershipError || !membership) {
    return { ok: false as const, status: 403, message: membershipError?.message ?? 'Forbidden' }
  }

  const access = await requireStoreFeatureAccess({
    supabase,
    storeId,
    minimumPlan: 'standard',
    requiredOption: 'hotel',
  })
  if (!access.ok) {
    return { ok: false as const, status: 403, message: access.message }
  }
  if (!isHotelFeatureEnabledForStore(storeId)) {
    return { ok: false as const, status: 403, message: 'Hotel feature is not enabled for this store.' }
  }
  return { ok: true as const, supabase, storeId, user, role: membership.role as string }
}

export async function GET(_: Request, context: { params: Promise<{ stay_id: string }> }) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { stay_id: stayId } = await context.params
  const { data: stay, error } = await guard.supabase
    .from('hotel_stays')
    .select(
      'id, created_at, updated_at, stay_code, customer_id, pet_id, appointment_id, pricing_rule_id, status, planned_check_in_at, planned_check_out_at, actual_check_in_at, actual_check_out_at, nights, pickup_required, dropoff_required, pickup_scheduled_at, dropoff_scheduled_at, pickup_staff_id, dropoff_staff_id, vaccine_expires_on, vaccine_verified_at, total_amount_jpy, notes'
    )
    .eq('store_id', guard.storeId)
    .eq('id', stayId)
    .maybeSingle()
  if (error || !stay) {
    return NextResponse.json({ message: error?.message ?? 'Not found' }, { status: 404 })
  }

  const [{ data: charges, error: chargeError }, { data: stayItems, error: stayItemsError }] =
    await Promise.all([
      guard.supabase
        .from('hotel_charges')
        .select('id, charge_type, label, quantity, unit_amount_jpy, line_amount_jpy, tax_rate, tax_included, created_at')
        .eq('store_id', guard.storeId)
        .eq('stay_id', stayId)
        .order('created_at', { ascending: true }),
      guard.supabase
        .from('hotel_stay_items')
        .select(
          'id, stay_id, menu_item_id, item_type, label_snapshot, billing_unit_snapshot, quantity, unit_price_snapshot, line_amount_jpy, tax_rate_snapshot, tax_included_snapshot, counts_toward_capacity, sort_order, notes'
        )
        .eq('store_id', guard.storeId)
        .eq('stay_id', stayId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

  if (chargeError) {
    return NextResponse.json({ message: chargeError.message }, { status: 500 })
  }
  if (stayItemsError) {
    return NextResponse.json({ message: stayItemsError.message }, { status: 500 })
  }

  return NextResponse.json({ stay: { ...stay, charges: charges ?? [], selected_items: stayItems ?? [] } })
}

export async function PATCH(request: Request, context: { params: Promise<{ stay_id: string }> }) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { stay_id: stayId } = await context.params
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const { data: existingStay, error: existingError } = await guard.supabase
    .from('hotel_stays')
    .select(
      'id, customer_id, pet_id, appointment_id, pricing_rule_id, status, planned_check_in_at, planned_check_out_at, actual_check_in_at, actual_check_out_at, nights, pickup_required, dropoff_required, pickup_scheduled_at, dropoff_scheduled_at, pickup_staff_id, dropoff_staff_id, vaccine_expires_on, notes'
    )
    .eq('store_id', guard.storeId)
    .eq('id', stayId)
    .maybeSingle()
  if (existingError || !existingStay) {
    return NextResponse.json({ message: existingError?.message ?? 'Not found' }, { status: 404 })
  }

  try {
    const plannedCheckInAt =
      parseIsoDateTime(body.planned_check_in_at, 'planned_check_in_at', false) ??
      (existingStay.planned_check_in_at as string)
    const plannedCheckOutAt =
      parseIsoDateTime(body.planned_check_out_at, 'planned_check_out_at', false) ??
      (existingStay.planned_check_out_at as string)
    const actualCheckInAt =
      parseIsoDateTime(body.actual_check_in_at, 'actual_check_in_at', false) ??
      (existingStay.actual_check_in_at as string | null)
    const actualCheckOutAt =
      parseIsoDateTime(body.actual_check_out_at, 'actual_check_out_at', false) ??
      (existingStay.actual_check_out_at as string | null)
    const nights = parseNights(
      body.nights,
      deriveNightsByPlannedRange(plannedCheckInAt, plannedCheckOutAt)
    )
    const customerId = parseOptionalString(body.customer_id) ?? (existingStay.customer_id as string | null)
    const petId = parseOptionalString(body.pet_id) ?? (existingStay.pet_id as string)
    const appointmentId =
      parseOptionalString(body.appointment_id) ?? (existingStay.appointment_id as string | null)
    const selectedItems = parseSelectedStayItems(body.selected_items)

    const [{ data: hotelSettings }, { count: overlapCount, error: overlapError }, { data: menuItems, error: menuItemsError }] =
      await Promise.all([
        guard.supabase
          .from('hotel_settings')
          .select('max_concurrent_pets')
          .eq('store_id', guard.storeId)
          .maybeSingle(),
        guard.supabase
          .from('hotel_stays')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', guard.storeId)
          .in('status', [...ACTIVE_STAY_STATUSES])
          .neq('id', stayId)
          .lt('planned_check_in_at', plannedCheckOutAt)
          .gt('planned_check_out_at', plannedCheckInAt),
        guard.supabase
          .from('hotel_menu_items')
          .select(
            'id, name, item_type, billing_unit, duration_minutes, default_quantity, price, tax_rate, tax_included, counts_toward_capacity, is_active, display_order, notes'
          )
          .eq('store_id', guard.storeId)
          .eq('is_active', true),
      ])

    if (overlapError) {
      return NextResponse.json({ message: overlapError.message }, { status: 500 })
    }
    if (menuItemsError) {
      return NextResponse.json({ message: menuItemsError.message }, { status: 500 })
    }

    const transportFlags = deriveTransportFlagsFromSelections({
      menuItems: (menuItems ?? []) as HotelMenuItemRow[],
      selections: selectedItems,
    })

    const maxConcurrentPets = Math.max(1, Number(hotelSettings?.max_concurrent_pets ?? 1))
    if ((overlapCount ?? 0) >= maxConcurrentPets) {
      return NextResponse.json(
        {
          message: `同時間帯の預かり頭数が上限です。現在の上限は ${maxConcurrentPets} 頭です。`,
          code: 'HOTEL_CAPACITY_EXCEEDED',
        },
        { status: 400 }
      )
    }

    await guard.supabase.from('hotel_stay_items').delete().eq('store_id', guard.storeId).eq('stay_id', stayId)

    const stayItemRows = buildStayItemSnapshots({
      storeId: guard.storeId,
      stayId,
      menuItems: (menuItems ?? []) as HotelMenuItemRow[],
      selections: selectedItems,
      nights,
    })

    if (stayItemRows.length > 0) {
      const { error: stayItemInsertError } = await guard.supabase.from('hotel_stay_items').insert(stayItemRows)
      if (stayItemInsertError) {
        return NextResponse.json({ message: stayItemInsertError.message }, { status: 500 })
      }
    }

    const totalAmountJpy = sumStayItemAmount(stayItemRows)
    const updatePayload = {
      customer_id: customerId,
      pet_id: petId,
      appointment_id: appointmentId,
      pricing_rule_id: null,
      status: parseStatus(body.status, existingStay.status as never),
      planned_check_in_at: plannedCheckInAt,
      planned_check_out_at: plannedCheckOutAt,
      actual_check_in_at: actualCheckInAt,
      actual_check_out_at: actualCheckOutAt,
      nights,
      pickup_required: transportFlags.pickupRequired,
      dropoff_required: transportFlags.dropoffRequired,
      pickup_scheduled_at:
        parseIsoDateTime(body.pickup_scheduled_at, 'pickup_scheduled_at', false) ??
        (existingStay.pickup_scheduled_at as string | null),
      dropoff_scheduled_at:
        parseIsoDateTime(body.dropoff_scheduled_at, 'dropoff_scheduled_at', false) ??
        (existingStay.dropoff_scheduled_at as string | null),
      pickup_staff_id: parseOptionalString(body.pickup_staff_id) ?? (existingStay.pickup_staff_id as string | null),
      dropoff_staff_id:
        parseOptionalString(body.dropoff_staff_id) ?? (existingStay.dropoff_staff_id as string | null),
      vaccine_expires_on:
        parseOptionalDate(body.vaccine_expires_on, 'vaccine_expires_on') ??
        (existingStay.vaccine_expires_on as string | null),
      notes: parseOptionalString(body.notes) ?? (existingStay.notes as string | null),
      total_amount_jpy: totalAmountJpy,
      updated_by_user_id: guard.user.id,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await guard.supabase
      .from('hotel_stays')
      .update(updatePayload)
      .eq('store_id', guard.storeId)
      .eq('id', stayId)
    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: stayId, total_amount_jpy: totalAmountJpy })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 400 })
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ stay_id: string }> }) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { stay_id: stayId } = await context.params
  const { error } = await guard.supabase
    .from('hotel_stays')
    .delete()
    .eq('store_id', guard.storeId)
    .eq('id', stayId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
