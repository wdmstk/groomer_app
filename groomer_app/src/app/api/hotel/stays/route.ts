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
import {
  deriveNightsByPlannedRange,
  generateStayCode,
  parseBoolean,
  parseIsoDateTime,
  parseNights,
  parseOptionalDate,
  parseOptionalString,
  parseStatus,
} from '@/lib/hotel/stays'

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

export async function GET(request: Request) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const status = parseOptionalString(searchParams.get('status'))
  const from = parseOptionalString(searchParams.get('from'))
  const to = parseOptionalString(searchParams.get('to'))
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 100
  const includeCharges = parseBoolean(searchParams.get('include_charges'), false)
  const includeItems = parseBoolean(searchParams.get('include_items'), true)

  let query = guard.supabase
    .from('hotel_stays')
    .select(
      'id, created_at, updated_at, stay_code, customer_id, pet_id, appointment_id, pricing_rule_id, status, planned_check_in_at, planned_check_out_at, actual_check_in_at, actual_check_out_at, nights, pickup_required, dropoff_required, pickup_scheduled_at, dropoff_scheduled_at, pickup_staff_id, dropoff_staff_id, vaccine_expires_on, vaccine_verified_at, total_amount_jpy, notes'
    )
    .eq('store_id', guard.storeId)
    .order('planned_check_in_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (from) query = query.gte('planned_check_in_at', from)
  if (to) query = query.lte('planned_check_in_at', to)

  const { data: stays, error } = await query
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (!includeCharges && !includeItems) {
    return NextResponse.json({ stays: stays ?? [] })
  }

  const stayIds = (stays ?? []).map((row) => row.id as string)
  if (stayIds.length === 0) {
    return NextResponse.json({ stays: [] })
  }

  const { data: charges, error: chargeError } = await guard.supabase
    .from('hotel_charges')
    .select('id, stay_id, charge_type, label, quantity, unit_amount_jpy, line_amount_jpy, created_at')
    .eq('store_id', guard.storeId)
    .in('stay_id', stayIds)
    .order('created_at', { ascending: true })

  if (chargeError) {
    return NextResponse.json({ message: chargeError.message }, { status: 500 })
  }

  const chargeMap = new Map<string, unknown[]>()
  for (const charge of charges ?? []) {
    const stayId = charge.stay_id as string
    const current = chargeMap.get(stayId) ?? []
    current.push(charge)
    chargeMap.set(stayId, current)
  }

  const merged = (stays ?? []).map((stay) => ({
    ...stay,
    charges: chargeMap.get(stay.id as string) ?? [],
  }))

  if (!includeItems) {
    return NextResponse.json({ stays: merged })
  }

  const { data: stayItems, error: stayItemsError } = await guard.supabase
    .from('hotel_stay_items')
    .select(
      'id, stay_id, menu_item_id, item_type, label_snapshot, billing_unit_snapshot, quantity, unit_price_snapshot, line_amount_jpy, tax_rate_snapshot, tax_included_snapshot, counts_toward_capacity, sort_order, notes, created_at'
    )
    .eq('store_id', guard.storeId)
    .in('stay_id', stayIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (stayItemsError) {
    return NextResponse.json({ message: stayItemsError.message }, { status: 500 })
  }

  const itemMap = new Map<string, unknown[]>()
  for (const item of stayItems ?? []) {
    const stayId = item.stay_id as string
    const current = itemMap.get(stayId) ?? []
    current.push(item)
    itemMap.set(stayId, current)
  }

  return NextResponse.json({
    stays: merged.map((stay) => ({
      ...stay,
      selected_items: itemMap.get(stay.id as string) ?? [],
    })),
  })
}

export async function POST(request: Request) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    const stayCode = parseOptionalString(body.stay_code) ?? generateStayCode()
    const petId = parseOptionalString(body.pet_id)
    if (!petId) {
      return NextResponse.json({ message: 'pet_id is required.' }, { status: 400 })
    }

    const plannedCheckInAt = parseIsoDateTime(body.planned_check_in_at, 'planned_check_in_at', true)
    const plannedCheckOutAt = parseIsoDateTime(body.planned_check_out_at, 'planned_check_out_at', true)
    const actualCheckInAt = parseIsoDateTime(body.actual_check_in_at, 'actual_check_in_at', false)
    const actualCheckOutAt = parseIsoDateTime(body.actual_check_out_at, 'actual_check_out_at', false)
    const derivedNights = deriveNightsByPlannedRange(plannedCheckInAt!, plannedCheckOutAt!)
    const nights = parseNights(body.nights, derivedNights)
    const customerIdInput = parseOptionalString(body.customer_id)
    const appointmentId = parseOptionalString(body.appointment_id)
    const selectedItems = parseSelectedStayItems(body.selected_items)

    const { data: petRow, error: petError } = await guard.supabase
      .from('pets')
      .select('id, customer_id')
      .eq('store_id', guard.storeId)
      .eq('id', petId)
      .maybeSingle()
    if (petError || !petRow) {
      return NextResponse.json({ message: petError?.message ?? 'pet not found.' }, { status: 400 })
    }

    const customerId = customerIdInput ?? (petRow.customer_id as string | null)
    if (customerId) {
      const { data: customerRow, error: customerError } = await guard.supabase
        .from('customers')
        .select('id')
        .eq('store_id', guard.storeId)
        .eq('id', customerId)
        .maybeSingle()
      if (customerError || !customerRow) {
        return NextResponse.json({ message: customerError?.message ?? 'customer not found.' }, { status: 400 })
      }
    }

    const { data: hotelSettings } = await guard.supabase
      .from('hotel_settings')
      .select('max_concurrent_pets')
      .eq('store_id', guard.storeId)
      .maybeSingle()

    const { count: overlapCount, error: overlapError } = await guard.supabase
      .from('hotel_stays')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', guard.storeId)
      .in('status', [...ACTIVE_STAY_STATUSES])
      .lt('planned_check_in_at', plannedCheckOutAt!)
      .gt('planned_check_out_at', plannedCheckInAt!)

    if (overlapError) {
      return NextResponse.json({ message: overlapError.message }, { status: 500 })
    }

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

    const { data: menuItems, error: menuItemsError } = await guard.supabase
      .from('hotel_menu_items')
      .select(
        'id, name, item_type, billing_unit, duration_minutes, default_quantity, price, tax_rate, tax_included, counts_toward_capacity, is_active, display_order, notes'
      )
      .eq('store_id', guard.storeId)
      .eq('is_active', true)

    if (menuItemsError) {
      return NextResponse.json({ message: menuItemsError.message }, { status: 500 })
    }

    const transportFlags = deriveTransportFlagsFromSelections({
      menuItems: (menuItems ?? []) as HotelMenuItemRow[],
      selections: selectedItems,
    })

    const { data: insertedStay, error: insertError } = await guard.supabase
      .from('hotel_stays')
      .insert({
        store_id: guard.storeId,
        stay_code: stayCode,
        customer_id: customerId,
        pet_id: petId,
        appointment_id: appointmentId,
        pricing_rule_id: null,
        status: parseStatus(body.status, 'reserved'),
        planned_check_in_at: plannedCheckInAt,
        planned_check_out_at: plannedCheckOutAt,
        actual_check_in_at: actualCheckInAt,
        actual_check_out_at: actualCheckOutAt,
        nights,
        pickup_required: transportFlags.pickupRequired,
        dropoff_required: transportFlags.dropoffRequired,
        pickup_scheduled_at: parseIsoDateTime(body.pickup_scheduled_at, 'pickup_scheduled_at', false),
        dropoff_scheduled_at: parseIsoDateTime(body.dropoff_scheduled_at, 'dropoff_scheduled_at', false),
        pickup_staff_id: parseOptionalString(body.pickup_staff_id),
        dropoff_staff_id: parseOptionalString(body.dropoff_staff_id),
        vaccine_expires_on: parseOptionalDate(body.vaccine_expires_on, 'vaccine_expires_on'),
        notes: parseOptionalString(body.notes),
        created_by_user_id: guard.user.id,
        updated_by_user_id: guard.user.id,
        total_amount_jpy: 0,
      })
      .select('id')
      .single()

    if (insertError || !insertedStay) {
      return NextResponse.json({ message: insertError?.message ?? 'insert failed' }, { status: 500 })
    }

    const stayItemRows = buildStayItemSnapshots({
      storeId: guard.storeId,
      stayId: insertedStay.id as string,
      menuItems: (menuItems ?? []) as HotelMenuItemRow[],
      selections: selectedItems,
      nights,
    })

    if (stayItemRows.length > 0) {
      const { error: stayItemInsertError } = await guard.supabase.from('hotel_stay_items').insert(stayItemRows)
      if (stayItemInsertError) {
        await guard.supabase.from('hotel_stays').delete().eq('store_id', guard.storeId).eq('id', insertedStay.id)
        return NextResponse.json({ message: stayItemInsertError.message }, { status: 500 })
      }
    }

    const totalAmountJpy = sumStayItemAmount(stayItemRows)

    const { error: totalUpdateError } = await guard.supabase
      .from('hotel_stays')
      .update({
        total_amount_jpy: totalAmountJpy,
        updated_by_user_id: guard.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('store_id', guard.storeId)
      .eq('id', insertedStay.id)

    if (totalUpdateError) {
      return NextResponse.json({ message: totalUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: insertedStay.id, total_amount_jpy: totalAmountJpy })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 400 })
  }
}
