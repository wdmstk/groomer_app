import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { asObjectOrNull } from '@/lib/object-utils'
import {
  buildTransportStatusPatch,
  deriveInitialTransportStatus,
  parseIsoDateTime,
  parseOptionalString,
  parseTransportStatus,
  parseTransportType,
} from '@/lib/hotel/transports'

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
  const transportType = parseTransportType(searchParams.get('transport_type'))
  const from = parseOptionalString(searchParams.get('from'))
  const to = parseOptionalString(searchParams.get('to'))
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 100

  let query = guard.supabase
    .from('hotel_transports')
    .select(
      'id, stay_id, transport_type, status, scheduled_at, dispatched_at, in_transit_at, arrived_at, completed_at, canceled_at, staff_id, source_address, destination_address, contact_name, contact_phone, notes, hotel_stays(stay_code, customer_id, pet_id, status)'
    )
    .eq('store_id', guard.storeId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (transportType) query = query.eq('transport_type', transportType)
  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json({ transports: data ?? [] })
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

  const stayId = parseOptionalString(body.stay_id)
  if (!stayId) {
    return NextResponse.json({ message: 'stay_id is required.' }, { status: 400 })
  }
  const transportType = parseTransportType(body.transport_type)
  if (!transportType) {
    return NextResponse.json({ message: 'transport_type must be pickup or dropoff.' }, { status: 400 })
  }
  const scheduledAt = parseIsoDateTime(body.scheduled_at, 'scheduled_at')
  const requestedStatus = parseTransportStatus(
    body.status,
    deriveInitialTransportStatus(scheduledAt)
  )

  const { data: stay, error: stayError } = await guard.supabase
    .from('hotel_stays')
    .select('id')
    .eq('store_id', guard.storeId)
    .eq('id', stayId)
    .maybeSingle()
  if (stayError || !stay) {
    return NextResponse.json({ message: stayError?.message ?? 'stay not found.' }, { status: 400 })
  }

  const payload = {
    store_id: guard.storeId,
    stay_id: stayId,
    transport_type: transportType,
    status: requestedStatus,
    scheduled_at: scheduledAt,
    staff_id: parseOptionalString(body.staff_id),
    source_address: parseOptionalString(body.source_address),
    destination_address: parseOptionalString(body.destination_address),
    contact_name: parseOptionalString(body.contact_name),
    contact_phone: parseOptionalString(body.contact_phone),
    notes: parseOptionalString(body.notes),
    created_by_user_id: guard.user.id,
    updated_by_user_id: guard.user.id,
    updated_at: new Date().toISOString(),
    ...buildTransportStatusPatch({ nextStatus: requestedStatus }),
  }

  const { data, error } = await guard.supabase
    .from('hotel_transports')
    .upsert(payload, { onConflict: 'stay_id,transport_type' })
    .select(
      'id, stay_id, transport_type, status, scheduled_at, dispatched_at, in_transit_at, arrived_at, completed_at, canceled_at, staff_id, source_address, destination_address, contact_name, contact_phone, notes'
    )
    .single()
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'upsert failed.' }, { status: 500 })
  }

  await guard.supabase.from('hotel_transport_logs').insert({
    store_id: guard.storeId,
    transport_id: data.id,
    actor_user_id: guard.user.id,
    event_type: 'created',
    payload: {
      transport_type: data.transport_type,
      status: data.status,
    },
  })

  return NextResponse.json({ transport: data })
}
