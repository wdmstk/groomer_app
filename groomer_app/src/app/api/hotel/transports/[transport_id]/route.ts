import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { asObjectOrNull } from '@/lib/object-utils'
import {
  buildTransportStatusPatch,
  parseIsoDateTime,
  parseOptionalString,
  parseTransportStatus,
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

type RouteParams = {
  params: Promise<{ transport_id: string }>
}

export async function GET(_: Request, context: RouteParams) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  const { transport_id: transportId } = await context.params

  const { data, error } = await guard.supabase
    .from('hotel_transports')
    .select(
      'id, stay_id, transport_type, status, scheduled_at, dispatched_at, in_transit_at, arrived_at, completed_at, canceled_at, staff_id, source_address, destination_address, contact_name, contact_phone, notes, hotel_stays(stay_code, customer_id, pet_id, status)'
    )
    .eq('store_id', guard.storeId)
    .eq('id', transportId)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'Not found' }, { status: 404 })
  }

  const { data: logs } = await guard.supabase
    .from('hotel_transport_logs')
    .select('id, created_at, event_type, payload, actor_user_id')
    .eq('store_id', guard.storeId)
    .eq('transport_id', transportId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ transport: data, logs: logs ?? [] })
}

export async function PATCH(request: Request, context: RouteParams) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  const { transport_id: transportId } = await context.params
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await guard.supabase
    .from('hotel_transports')
    .select(
      'id, status, transport_type, scheduled_at, staff_id, source_address, destination_address, contact_name, contact_phone, notes'
    )
    .eq('store_id', guard.storeId)
    .eq('id', transportId)
    .maybeSingle()
  if (existingError || !existing) {
    return NextResponse.json({ message: existingError?.message ?? 'Not found' }, { status: 404 })
  }

  const nextStatus = parseTransportStatus(body.status, existing.status)
  const scheduledAt = parseIsoDateTime(body.scheduled_at, 'scheduled_at') ?? existing.scheduled_at

  const payload = {
    status: nextStatus,
    scheduled_at: scheduledAt,
    staff_id: parseOptionalString(body.staff_id) ?? existing.staff_id,
    source_address: parseOptionalString(body.source_address) ?? existing.source_address,
    destination_address: parseOptionalString(body.destination_address) ?? existing.destination_address,
    contact_name: parseOptionalString(body.contact_name) ?? existing.contact_name,
    contact_phone: parseOptionalString(body.contact_phone) ?? existing.contact_phone,
    notes: parseOptionalString(body.notes) ?? existing.notes,
    updated_by_user_id: guard.user.id,
    updated_at: new Date().toISOString(),
    ...buildTransportStatusPatch({ nextStatus }),
  }

  const { data, error } = await guard.supabase
    .from('hotel_transports')
    .update(payload)
    .eq('store_id', guard.storeId)
    .eq('id', transportId)
    .select(
      'id, stay_id, transport_type, status, scheduled_at, dispatched_at, in_transit_at, arrived_at, completed_at, canceled_at, staff_id, source_address, destination_address, contact_name, contact_phone, notes'
    )
    .single()
  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'update failed' }, { status: 500 })
  }

  const eventType =
    nextStatus !== existing.status
      ? nextStatus === 'canceled'
        ? 'canceled'
        : 'status_changed'
      : 'updated'

  await guard.supabase.from('hotel_transport_logs').insert({
    store_id: guard.storeId,
    transport_id: transportId,
    actor_user_id: guard.user.id,
    event_type: eventType,
    payload: {
      before_status: existing.status,
      after_status: nextStatus,
      scheduled_at: data.scheduled_at,
      staff_id: data.staff_id,
    },
  })

  return NextResponse.json({ transport: data })
}

export async function DELETE(_: Request, context: RouteParams) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  if (guard.role !== 'owner' && guard.role !== 'admin') {
    return NextResponse.json({ message: 'Only owner/admin can delete transport rows.' }, { status: 403 })
  }

  const { transport_id: transportId } = await context.params
  const { data: existing } = await guard.supabase
    .from('hotel_transports')
    .select('id')
    .eq('store_id', guard.storeId)
    .eq('id', transportId)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }

  const { error } = await guard.supabase
    .from('hotel_transports')
    .delete()
    .eq('store_id', guard.storeId)
    .eq('id', transportId)
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
