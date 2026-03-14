import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { asObjectOrNull } from '@/lib/object-utils'
import { parseBoolean, parseOptionalString } from '@/lib/hotel/stays'
import { parseOptionalInteger, parsePositiveNumber } from '@/lib/hotel/stay-items'

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

function parseItemType(value: unknown) {
  if (
    value === 'overnight' ||
    value === 'time_pack' ||
    value === 'option' ||
    value === 'transport' ||
    value === 'other'
  ) {
    return value
  }
  return 'option'
}

function parseBillingUnit(value: unknown) {
  if (value === 'per_stay' || value === 'per_night' || value === 'per_hour' || value === 'fixed') {
    return value
  }
  return 'fixed'
}

export async function GET() {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { data, error } = await guard.supabase
    .from('hotel_menu_items')
    .select(
      'id, name, item_type, billing_unit, duration_minutes, default_quantity, price, tax_rate, tax_included, counts_toward_capacity, is_active, display_order, notes'
    )
    .eq('store_id', guard.storeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ menu_items: data ?? [] })
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

  const name = parseOptionalString(body.name)
  if (!name) {
    return NextResponse.json({ message: 'name is required.' }, { status: 400 })
  }

  const payload = {
    store_id: guard.storeId,
    name,
    item_type: parseItemType(body.item_type),
    billing_unit: parseBillingUnit(body.billing_unit),
    duration_minutes: parseOptionalInteger(body.duration_minutes),
    default_quantity: parsePositiveNumber(body.default_quantity, 1),
    price: Math.max(0, parseOptionalInteger(body.price, 0) ?? 0),
    tax_rate: typeof body.tax_rate === 'number' ? body.tax_rate : 0.1,
    tax_included: parseBoolean(body.tax_included, true),
    counts_toward_capacity: parseBoolean(body.counts_toward_capacity, false),
    is_active: parseBoolean(body.is_active, true),
    display_order: parseOptionalInteger(body.display_order, 0) ?? 0,
    notes: parseOptionalString(body.notes),
  }

  const { data, error } = await guard.supabase
    .from('hotel_menu_items')
    .insert(payload)
    .select(
      'id, name, item_type, billing_unit, duration_minutes, default_quantity, price, tax_rate, tax_included, counts_toward_capacity, is_active, display_order, notes'
    )
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, menu_item: data })
}
