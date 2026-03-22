import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { HotelMenuTemplateOverwriteScope } from '@/lib/hq/hotel-menu-template-distribution'
import { getStoreIdsByHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'
import type { Json } from '@/lib/supabase/database.types'

type HotelMenuItemRow = {
  id: string
  store_id: string
  item_type: string
  name: string
  price: number
  billing_unit: string
  default_quantity: number
  duration_minutes: number | null
  counts_toward_capacity: boolean
  tax_rate: number
  tax_included: boolean
  is_active: boolean
  display_order: number
  notes: string | null
}

type SubscriptionRow = {
  store_id: string
  plan_code: string | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
}

type DistributePayload = {
  sourceStoreId?: string
  targetStoreIds?: string[]
  overwriteScope?: HotelMenuTemplateOverwriteScope
}

function isHotelOptionEnabled(row: SubscriptionRow) {
  return (row.hotel_option_effective ?? row.hotel_option_enabled ?? false) === true
}

function withHqActorScope(payload?: Json): Json {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { actor_scope: 'hq', ...payload }
  }
  return { actor_scope: 'hq' }
}

async function writeAuditLog(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  storeId: string
  actorUserId: string
  entityId: string
  action: string
  before?: Json
  after?: Json
  payload?: Json
}) {
  const { error } = await params.supabase.from('audit_logs').insert({
    store_id: params.storeId,
    actor_user_id: params.actorUserId,
    actor_scope: 'hq',
    entity_type: 'hq_hotel_menu_template_delivery',
    entity_id: params.entityId,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
    payload: withHqActorScope(params.payload),
  })
  if (error) {
    console.warn('failed_to_write_hq_audit_log', {
      storeId: params.storeId,
      action: params.action,
      message: error.message,
    })
  }
}

async function resolveManageableStores() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ message: 'ログインが必要です。' }, { status: 401 }) }
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipsError) {
    return { error: NextResponse.json({ message: membershipsError.message }, { status: 500 }) }
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const candidateStoreIds = getStoreIdsByHqCapability(memberships, 'hq_template_request')
  if (candidateStoreIds.length === 0) {
    return {
      error: NextResponse.json(
        { message: 'owner の所属店舗がないため本部ホテルメニューテンプレ機能を利用できません。' },
        { status: 403 }
      ),
    }
  }

  const { data: subscriptionRows } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code, hotel_option_effective, hotel_option_enabled')
    .in('store_id', candidateStoreIds)
  const manageableStoreIds = ((subscriptionRows ?? []) as SubscriptionRow[])
    .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code), 'pro') && isHotelOptionEnabled(row))
    .map((row) => row.store_id)

  if (manageableStoreIds.length === 0) {
    return {
      error: NextResponse.json(
        {
          message:
            'Proプランかつホテルオプション有効な owner 所属店舗がないため本部ホテルメニューテンプレ機能を利用できません。',
        },
        { status: 403 }
      ),
    }
  }

  return { supabase, manageableStoreIds }
}

export async function GET(request: Request) {
  const resolved = await resolveManageableStores()
  if (resolved.error) return resolved.error
  const { supabase, manageableStoreIds } = resolved

  const url = new URL(request.url)
  const sourceStoreId = url.searchParams.get('source_store_id') ?? manageableStoreIds[0]

  if (!manageableStoreIds.includes(sourceStoreId)) {
    return NextResponse.json({ message: 'source_store_id の権限がありません。' }, { status: 403 })
  }

  const [{ data: sourceMenusData, error: sourceMenusError }, { data: storesData, error: storesError }] =
    await Promise.all([
      supabase
        .from('hotel_menu_items')
        .select(
          'id, store_id, item_type, name, price, billing_unit, default_quantity, duration_minutes, counts_toward_capacity, tax_rate, tax_included, is_active, display_order, notes'
        )
        .eq('store_id', sourceStoreId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('stores').select('id, name').in('id', manageableStoreIds).order('created_at', { ascending: true }),
    ])

  if (sourceMenusError) {
    return NextResponse.json({ message: sourceMenusError.message }, { status: 500 })
  }
  if (storesError) {
    return NextResponse.json({ message: storesError.message }, { status: 500 })
  }

  const sourceMenus = (sourceMenusData ?? []) as HotelMenuItemRow[]
  const stores = (storesData ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? '店舗名未設定',
    isSource: row.id === sourceStoreId,
  }))

  return NextResponse.json({
    sourceStoreId,
    sourceMenus,
    stores,
    overwriteScopeOptions: ['price_duration_only', 'full'],
  })
}

export async function POST(request: Request) {
  const resolved = await resolveManageableStores()
  if (resolved.error) return resolved.error
  const { supabase, manageableStoreIds } = resolved

  let body: DistributePayload
  try {
    body = (await request.json()) as DistributePayload
  } catch {
    return NextResponse.json({ message: 'JSON ボディを指定してください。' }, { status: 400 })
  }

  const sourceStoreId = body.sourceStoreId
  const targetStoreIds = Array.from(new Set(body.targetStoreIds ?? []))
  const overwriteScope = body.overwriteScope ?? 'price_duration_only'

  if (!sourceStoreId) {
    return NextResponse.json({ message: 'sourceStoreId は必須です。' }, { status: 400 })
  }
  if (!targetStoreIds.length) {
    return NextResponse.json({ message: 'targetStoreIds は1件以上必須です。' }, { status: 400 })
  }
  if (overwriteScope !== 'price_duration_only' && overwriteScope !== 'full') {
    return NextResponse.json({ message: 'overwriteScope が不正です。' }, { status: 400 })
  }
  if (!manageableStoreIds.includes(sourceStoreId)) {
    return NextResponse.json({ message: 'sourceStoreId の操作権限がありません。' }, { status: 403 })
  }

  const invalidTarget = targetStoreIds.find((storeId) => !manageableStoreIds.includes(storeId))
  if (invalidTarget) {
    return NextResponse.json({ message: `targetStoreId の操作権限がありません: ${invalidTarget}` }, { status: 403 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ message: 'ログインが必要です。' }, { status: 401 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('hq_hotel_menu_template_deliveries' as never)
    .insert({
      source_store_id: sourceStoreId,
      target_store_ids: targetStoreIds,
      overwrite_scope: overwriteScope,
      status: 'pending',
      requested_by_user_id: user.id,
    })
    .select('id, source_store_id, target_store_ids, overwrite_scope, status, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 })
  }

  await writeAuditLog({
    supabase,
    storeId: sourceStoreId,
    actorUserId: user.id,
    entityId: inserted.id as string,
    action: 'hq_hotel_menu_template_delivery_requested',
    before: null,
    after: {
      status: inserted.status,
      source_store_id: sourceStoreId,
      target_store_ids: targetStoreIds,
      overwrite_scope: overwriteScope,
    },
    payload: {
      target_store_ids: targetStoreIds,
      overwrite_scope: overwriteScope,
    },
  })

  return NextResponse.json({
    message: 'ホテルメニューテンプレ配信リクエストを作成しました。owner 承認後に適用されます。',
    delivery: inserted,
  })
}
