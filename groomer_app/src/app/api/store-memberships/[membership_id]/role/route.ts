import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { isPlanAtLeast } from '@/lib/subscription-plan'

type RouteParams = {
  params: Promise<{
    membership_id: string
  }>
}

const ALLOWED_ROLES = new Set(['owner', 'admin', 'staff'])

async function updateMembershipRole(request: Request, membershipId: string, redirectOnSuccess: boolean) {
  const { supabase, storeId } = await createStoreScopedClient()
  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(supabase),
    storeId,
  })
  if (!isPlanAtLeast(planState.planCode, 'standard')) {
    return NextResponse.json(
      { message: 'ライトプランでは権限変更は利用できません。スタンダード以上で利用できます。' },
      { status: 403 }
    )
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: actorMembership, error: actorMembershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (actorMembershipError) {
    return NextResponse.json({ message: actorMembershipError.message }, { status: 500 })
  }

  if (!actorMembership || actorMembership.role !== 'owner') {
    return NextResponse.json({ message: '権限変更は owner のみ実行できます。' }, { status: 403 })
  }

  let requestedRole = ''
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    requestedRole = typeof body?.role === 'string' ? body.role.trim() : ''
  } else {
    const formData = await request.formData().catch(() => null)
    requestedRole = formData?.get('role')?.toString().trim() ?? ''
  }
  if (!ALLOWED_ROLES.has(requestedRole)) {
    return NextResponse.json({ message: 'ロールは owner/admin/staff のみ指定できます。' }, { status: 400 })
  }

  const { data: targetMembership, error: targetMembershipError } = await supabase
    .from('store_memberships')
    .select('id, user_id, role')
    .eq('id', membershipId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .maybeSingle()

  if (targetMembershipError) {
    return NextResponse.json({ message: targetMembershipError.message }, { status: 500 })
  }

  if (!targetMembership) {
    return NextResponse.json({ message: '対象メンバーが見つかりません。' }, { status: 404 })
  }

  if (targetMembership.role === requestedRole) {
    if (redirectOnSuccess) {
      return NextResponse.redirect(new URL('/staffs?tab=list', request.url))
    }
    return NextResponse.json({ message: 'ロール変更はありません。' }, { status: 200 })
  }

  if (targetMembership.role === 'owner' && requestedRole !== 'owner') {
    const { count: ownerCount, error: ownerCountError } = await supabase
      .from('store_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('is_active', true)
      .eq('role', 'owner')

    if (ownerCountError) {
      return NextResponse.json({ message: ownerCountError.message }, { status: 500 })
    }

    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json({ message: '最後の owner は変更できません。' }, { status: 400 })
    }
  }

  const { error: updateError } = await supabase
    .from('store_memberships')
    .update({ role: requestedRole })
    .eq('id', membershipId)
    .eq('store_id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  if (redirectOnSuccess) {
    return NextResponse.redirect(new URL('/staffs?tab=list', request.url))
  }
  return NextResponse.json({ message: 'ロールを更新しました。' }, { status: 200 })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { membership_id } = await params
  return updateMembershipRole(request, membership_id, true)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { membership_id } = await params
  return updateMembershipRole(request, membership_id, false)
}
