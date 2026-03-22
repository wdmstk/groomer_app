import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  applyHotelMenuTemplateDistribution,
  type HotelMenuTemplateOverwriteScope,
} from '@/lib/hq/hotel-menu-template-distribution'
import { getManageableRoleByStoreId, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'
import type { Json } from '@/lib/supabase/database.types'

type RouteParams = {
  params: Promise<{
    delivery_id: string
  }>
}

type DeliveryRow = {
  id: string
  source_store_id: string
  target_store_ids: string[]
  overwrite_scope: HotelMenuTemplateOverwriteScope
  status: 'pending' | 'applied' | 'rejected'
  approved_by_user_ids: string[] | null
}

type SubscriptionRow = {
  store_id: string
  plan_code: string | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
}

type ApprovalPayload = {
  storeId?: string
  decision?: 'approved' | 'rejected'
  comment?: string
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

export async function POST(request: Request, { params }: RouteParams) {
  const { delivery_id } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'ログインが必要です。' }, { status: 401 })
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipsError) {
    return NextResponse.json({ message: membershipsError.message }, { status: 500 })
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const candidateByStoreId = getManageableRoleByStoreId(memberships, 'hq_template_approve')
  const candidateStoreIds = Array.from(candidateByStoreId.keys())
  if (candidateStoreIds.length === 0) {
    return NextResponse.json(
      { message: 'Proプランの承認権限（owner）がある店舗がありません。' },
      { status: 403 }
    )
  }
  const { data: subscriptionRows } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code, hotel_option_effective, hotel_option_enabled')
    .in('store_id', candidateStoreIds)
  const proStoreIdSet = new Set(
    ((subscriptionRows ?? []) as SubscriptionRow[])
      .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code), 'pro') && isHotelOptionEnabled(row))
      .map((row) => row.store_id)
  )
  const manageableByStoreId = new Map(
    Array.from(candidateByStoreId.entries()).filter(([storeId]) => proStoreIdSet.has(storeId))
  )

  let body: ApprovalPayload
  try {
    body = (await request.json()) as ApprovalPayload
  } catch {
    return NextResponse.json({ message: 'JSON ボディを指定してください。' }, { status: 400 })
  }

  const storeId = body.storeId
  const decision = body.decision ?? 'approved'
  if (!storeId) {
    return NextResponse.json({ message: 'storeId は必須です。' }, { status: 400 })
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ message: 'decision が不正です。' }, { status: 400 })
  }

  const actorRole = manageableByStoreId.get(storeId)
  if (!actorRole) {
    return NextResponse.json({ message: 'この店舗の承認権限（owner）がありません。' }, { status: 403 })
  }

  const { data: deliveryData, error: deliveryError } = await supabase
    .from('hq_hotel_menu_template_deliveries' as never)
    .select('id, source_store_id, target_store_ids, overwrite_scope, status, approved_by_user_ids')
    .eq('id', delivery_id)
    .single()

  if (deliveryError) {
    return NextResponse.json({ message: deliveryError.message }, { status: 404 })
  }

  const delivery = deliveryData as DeliveryRow
  if (!delivery.target_store_ids.includes(storeId)) {
    return NextResponse.json({ message: '指定storeIdはこの配信リクエストの対象外です。' }, { status: 400 })
  }
  if (delivery.status !== 'pending') {
    return NextResponse.json({ message: `この配信は ${delivery.status} です。`, delivery }, { status: 200 })
  }

  const { error: upsertError } = await supabase.from('hq_hotel_menu_template_delivery_approvals' as never).upsert(
    {
      delivery_id,
      store_id: storeId,
      approver_user_id: user.id,
      approver_role: actorRole,
      status: decision,
      comment: body.comment ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'delivery_id,store_id' }
  )

  if (upsertError) {
    return NextResponse.json({ message: upsertError.message }, { status: 500 })
  }

  await writeAuditLog({
    supabase,
    storeId,
    actorUserId: user.id,
    entityId: delivery_id,
    action: 'hq_hotel_menu_template_delivery_approval_recorded',
    before: {
      status: delivery.status,
    },
    after: {
      status: delivery.status,
      decision,
    },
    payload: {
      decision,
      comment: body.comment ?? null,
      source_store_id: delivery.source_store_id,
      target_store_ids: delivery.target_store_ids,
    },
  })

  if (decision === 'rejected') {
    const { error: rejectError } = await supabase
      .from('hq_hotel_menu_template_deliveries' as never)
      .update({
        status: 'rejected',
        last_error: body.comment ?? '承認が拒否されました。',
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery_id)
      .eq('status', 'pending')

    if (rejectError) {
      return NextResponse.json({ message: rejectError.message }, { status: 500 })
    }

    await writeAuditLog({
      supabase,
      storeId,
      actorUserId: user.id,
      entityId: delivery_id,
      action: 'hq_hotel_menu_template_delivery_rejected',
      before: {
        status: 'pending',
      },
      after: {
        status: 'rejected',
      },
      payload: {
        reason: body.comment ?? '承認が拒否されました。',
      },
    })

    return NextResponse.json({ message: '配信リクエストを拒否しました。', status: 'rejected' })
  }

  const { data: approvalsData, error: approvalsError } = await supabase
    .from('hq_hotel_menu_template_delivery_approvals' as never)
    .select('store_id, approver_user_id, status')
    .eq('delivery_id', delivery_id)
    .eq('status', 'approved')

  if (approvalsError) {
    return NextResponse.json({ message: approvalsError.message }, { status: 500 })
  }

  const approvedRows = approvalsData ?? []
  const approvedStoreIds = Array.from(new Set(approvedRows.map((row: { store_id: string }) => row.store_id)))
  const allApproved = delivery.target_store_ids.every((targetStoreId) => approvedStoreIds.includes(targetStoreId))

  const approvedByUserIds = Array.from(
    new Set(approvedRows.map((row: { approver_user_id: string }) => row.approver_user_id))
  )

  if (!allApproved) {
    const { error: pendingUpdateError } = await supabase
      .from('hq_hotel_menu_template_deliveries' as never)
      .update({
        approved_by_user_ids: approvedByUserIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery_id)
      .eq('status', 'pending')

    if (pendingUpdateError) {
      return NextResponse.json({ message: pendingUpdateError.message }, { status: 500 })
    }

    await writeAuditLog({
      supabase,
      storeId,
      actorUserId: user.id,
      entityId: delivery_id,
      action: 'hq_hotel_menu_template_delivery_waiting_remaining_approvals',
      before: {
        status: 'pending',
      },
      after: {
        status: 'pending',
      },
      payload: {
        approved_store_ids: approvedStoreIds,
        required_store_ids: delivery.target_store_ids,
      },
    })

    return NextResponse.json({
      message: '承認を記録しました。全対象店舗の承認待ちです。',
      approvedStoreIds,
      requiredStoreIds: delivery.target_store_ids,
      status: 'pending',
    })
  }

  const applyResult = await applyHotelMenuTemplateDistribution({
    supabase,
    sourceStoreId: delivery.source_store_id,
    targetStoreIds: delivery.target_store_ids,
    overwriteScope: delivery.overwrite_scope,
  })

  if (applyResult.errorMessage) {
    const { error: errorUpdateError } = await supabase
      .from('hq_hotel_menu_template_deliveries' as never)
      .update({
        last_error: applyResult.errorMessage,
        approved_by_user_ids: approvedByUserIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery_id)

    if (errorUpdateError) {
      return NextResponse.json({ message: errorUpdateError.message }, { status: 500 })
    }

    await writeAuditLog({
      supabase,
      storeId,
      actorUserId: user.id,
      entityId: delivery_id,
      action: 'hq_hotel_menu_template_delivery_apply_failed',
      before: {
        status: 'pending',
      },
      after: {
        status: 'pending',
      },
      payload: {
        error: applyResult.errorMessage,
      },
    })

    return NextResponse.json({ message: applyResult.errorMessage }, { status: 500 })
  }

  const appliedAt = new Date().toISOString()
  const { error: applyUpdateError } = await supabase
    .from('hq_hotel_menu_template_deliveries' as never)
    .update({
      status: 'applied',
      approved_by_user_ids: approvedByUserIds,
      applied_at: appliedAt,
      applied_summary: { results: applyResult.results },
      last_error: null,
      updated_at: appliedAt,
    })
    .eq('id', delivery_id)
    .eq('status', 'pending')

  if (applyUpdateError) {
    return NextResponse.json({ message: applyUpdateError.message }, { status: 500 })
  }

  await writeAuditLog({
    supabase,
    storeId,
    actorUserId: user.id,
    entityId: delivery_id,
    action: 'hq_hotel_menu_template_delivery_applied',
    before: {
      status: 'pending',
    },
    after: {
      status: 'applied',
      applied_at: appliedAt,
    },
    payload: {
      approved_store_ids: approvedStoreIds,
      results: applyResult.results,
    },
  })

  return NextResponse.json({
    message: '全店舗承認が揃ったためホテルメニューテンプレ配信を適用しました。',
    status: 'applied',
    results: applyResult.results,
  })
}
