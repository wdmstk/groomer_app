import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { hotelPageFixtures } from '@/lib/e2e/hotel-page-fixtures'

const HotelStaysManager = nextDynamic(
  () => import('@/components/hotel/HotelStaysManager').then((mod) => mod.HotelStaysManager),
  {
    loading: () => (
      <Card>
        <p className="text-sm text-gray-500">ホテル台帳を読み込み中...</p>
      </Card>
    ),
  }
)

export const dynamic = 'force-dynamic'
export const revalidate = 0
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type RelatedName = { id: string; full_name?: string | null; name?: string | null; customer_id?: string | null }
type ChargeRow = {
  id: string
  charge_type: string
  label: string
  quantity: number
  unit_amount_jpy: number
  line_amount_jpy: number
}

type StayItemRow = {
  id: string
  menu_item_id: string | null
  item_type: string
  label_snapshot: string
  billing_unit_snapshot: string
  quantity: number
  unit_price_snapshot: number
  line_amount_jpy: number
  counts_toward_capacity: boolean
  sort_order: number
  notes: string | null
}

type StayRow = {
  id: string
  stay_code: string
  status: string
  customer_id: string | null
  pet_id: string
  planned_check_in_at: string
  planned_check_out_at: string
  actual_check_in_at: string | null
  actual_check_out_at: string | null
  nights: number
  pickup_required: boolean
  dropoff_required: boolean
  vaccine_expires_on: string | null
  total_amount_jpy: number
  notes: string | null
  charges?: ChargeRow[]
  selected_items?: StayItemRow[]
}

type HotelSettingsRow = {
  id: string | null
  store_id: string
  max_concurrent_pets: number
  calendar_open_hour: number | null
  calendar_close_hour: number | null
}

type HotelMenuItemRow = {
  id: string
  name: string
  item_type: string
  billing_unit: string
  duration_minutes: number | null
  default_quantity: number
  price: number
  tax_rate: number
  tax_included: boolean
  counts_toward_capacity: boolean
  is_active: boolean
  display_order: number
  notes: string | null
}

export default async function HotelPage() {
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: hotelPageFixtures.storeId }
    : await createStoreScopedClient()
  const access = isPlaywrightE2E
    ? hotelPageFixtures.access
    : await requireStoreFeatureAccess({
        supabase,
        storeId,
        minimumPlan: 'standard',
        requiredOption: 'hotel',
      })
  const hotelEnabled = isPlaywrightE2E ? true : isHotelFeatureEnabledForStore(storeId)
  const user = isPlaywrightE2E
    ? hotelPageFixtures.user
    : (
        await supabase.auth.getUser()
      ).data.user

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ペットホテル管理</h1>
        <Card>
          <p className="text-sm text-red-700">ログインが必要です。</p>
        </Card>
      </section>
    )
  }

  const membership = isPlaywrightE2E
    ? hotelPageFixtures.membership
    : (
        await supabase!
          .from('store_memberships')
          .select('role')
          .eq('store_id', storeId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
      ).data
  const stays = isPlaywrightE2E
    ? hotelPageFixtures.stays
    : (
        await supabase!
          .from('hotel_stays')
          .select(
            'id, stay_code, status, customer_id, pet_id, planned_check_in_at, planned_check_out_at, actual_check_in_at, actual_check_out_at, nights, pickup_required, dropoff_required, vaccine_expires_on, total_amount_jpy, notes'
          )
          .eq('store_id', storeId)
          .order('planned_check_in_at', { ascending: false })
          .limit(200)
      ).data
  const charges = isPlaywrightE2E
    ? []
    : (
        await supabase!
          .from('hotel_charges')
          .select('id, stay_id, charge_type, label, quantity, unit_amount_jpy, line_amount_jpy')
          .eq('store_id', storeId)
          .order('created_at', { ascending: true })
      ).data
  const stayItems = isPlaywrightE2E
    ? hotelPageFixtures.stayItems
    : (
        await supabase!
          .from('hotel_stay_items')
          .select(
            'id, stay_id, menu_item_id, item_type, label_snapshot, billing_unit_snapshot, quantity, unit_price_snapshot, line_amount_jpy, counts_toward_capacity, sort_order, notes'
          )
          .eq('store_id', storeId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      ).data
  const customers = isPlaywrightE2E
    ? hotelPageFixtures.customers
    : (
        await supabase!.from('customers').select('id, full_name').eq('store_id', storeId).order('full_name', { ascending: true })
      ).data
  const pets = isPlaywrightE2E
    ? hotelPageFixtures.pets
    : (
        await supabase!
          .from('pets')
          .select('id, name, customer_id')
          .eq('store_id', storeId)
          .order('name', { ascending: true })
      ).data
  const menuItems = isPlaywrightE2E
    ? hotelPageFixtures.menuItems
    : (
        await supabase!
          .from('hotel_menu_items')
          .select(
            'id, name, item_type, billing_unit, duration_minutes, default_quantity, price, tax_rate, tax_included, counts_toward_capacity, is_active, display_order, notes'
          )
          .eq('store_id', storeId)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true })
      ).data
  const hotelSettings = isPlaywrightE2E
    ? hotelPageFixtures.settings
    : (
        await supabase!
          .from('hotel_settings')
          .select('id, store_id, max_concurrent_pets, calendar_open_hour, calendar_close_hour')
          .eq('store_id', storeId)
          .maybeSingle()
      ).data

  const role = membership?.role ?? null
  if (!role) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ペットホテル管理</h1>
        <Card>
          <p className="text-sm text-red-700">店舗への所属が確認できません。</p>
        </Card>
      </section>
    )
  }

  if (!access.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ペットホテル管理</h1>
        <Card>
          <p className="text-sm text-amber-700">{access.message}</p>
        </Card>
      </section>
    )
  }

  if (!hotelEnabled) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">ペットホテル管理</h1>
        <Card>
          <p className="text-sm text-amber-700">
            この店舗は限定リリース対象外です。運用チームに有効化を依頼してください。
          </p>
        </Card>
      </section>
    )
  }

  const chargeMap = new Map<string, ChargeRow[]>()
  for (const row of charges ?? []) {
    const stayId = row.stay_id as string
    const current = chargeMap.get(stayId) ?? []
    current.push({
      id: row.id as string,
      charge_type: String(row.charge_type ?? ''),
      label: String(row.label ?? ''),
      quantity: Number(row.quantity ?? 0),
      unit_amount_jpy: Number(row.unit_amount_jpy ?? 0),
      line_amount_jpy: Number(row.line_amount_jpy ?? 0),
    })
    chargeMap.set(stayId, current)
  }

  const stayItemMap = new Map<string, StayItemRow[]>()
  for (const row of stayItems ?? []) {
    const stayId = row.stay_id as string
    const current = stayItemMap.get(stayId) ?? []
    current.push({
      id: row.id as string,
      menu_item_id: (row.menu_item_id as string | null) ?? null,
      item_type: String(row.item_type ?? ''),
      label_snapshot: String(row.label_snapshot ?? ''),
      billing_unit_snapshot: String(row.billing_unit_snapshot ?? ''),
      quantity: Number(row.quantity ?? 0),
      unit_price_snapshot: Number(row.unit_price_snapshot ?? 0),
      line_amount_jpy: Number(row.line_amount_jpy ?? 0),
      counts_toward_capacity: Boolean(row.counts_toward_capacity),
      sort_order: Number(row.sort_order ?? 0),
      notes: (row.notes as string | null) ?? null,
    })
    stayItemMap.set(stayId, current)
  }

  const stayRows = ((stays ?? []) as StayRow[]).map((stay) => ({
    ...stay,
    charges: chargeMap.get(stay.id) ?? [],
    selected_items: stayItemMap.get(stay.id) ?? [],
  }))

  const customerOptions = ((customers ?? []) as RelatedName[]).map((row) => ({
    id: row.id,
    label: row.full_name ?? row.id,
  }))
  const petOptions = ((pets ?? []) as RelatedName[]).map((row) => ({
    id: row.id,
    label: row.name ?? row.id,
    customer_id: row.customer_id ?? undefined,
  }))

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">ペットホテル管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          時間預かりと宿泊を同じ台帳で管理し、週カレンダーで重複と定員を確認できます。
        </p>
      </div>
      <HotelStaysManager
        initialStays={stayRows}
        customers={customerOptions}
        pets={petOptions}
        menuItems={(menuItems ?? []) as HotelMenuItemRow[]}
        initialSettings={
          (hotelSettings as HotelSettingsRow | null) ?? {
            id: null,
            store_id: storeId,
            max_concurrent_pets: 1,
            calendar_open_hour: 8,
            calendar_close_hour: 20,
          }
        }
      />
    </section>
  )
}
