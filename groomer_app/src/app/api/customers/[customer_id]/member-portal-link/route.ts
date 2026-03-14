import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
  generateMemberPortalToken,
  getMemberPortalExpiresAt,
  hashMemberPortalToken,
  MEMBER_PORTAL_LINK_DAYS,
} from '@/lib/member-portal'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RouteParams = {
  params: Promise<{
    customer_id: string
  }>
}

async function getCurrentMembership() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    return { error: NextResponse.json({ message: membershipError.message }, { status: 500 }) }
  }

  if (!membership) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }

  return {
    supabase,
    storeId,
    userId: user.id,
    role: membership.role as 'owner' | 'admin' | 'staff',
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const allowed = await getCurrentMembership()
  if ('error' in allowed) return allowed.error

  const { customer_id } = await params
  const { supabase, storeId, userId } = allowed
  const adminSupabase = createAdminSupabaseClient()

  const expiresAt = getMemberPortalExpiresAt(MEMBER_PORTAL_LINK_DAYS)
  const nowIso = new Date().toISOString()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('id', customer_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (customerError) {
    return NextResponse.json({ message: customerError.message }, { status: 500 })
  }

  if (!customer) {
    return NextResponse.json({ message: '対象顧客が見つかりません。' }, { status: 404 })
  }

  const { data: activeLinks, error: activeLinksError } = await adminSupabase
    .from('member_portal_links')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', customer_id)
    .eq('purpose', 'member_portal')
    .is('revoked_at', null)

  if (activeLinksError) {
    return NextResponse.json({ message: activeLinksError.message }, { status: 500 })
  }

  const activeLinkIds = (activeLinks ?? []).map((row) => row.id as string)
  if (activeLinkIds.length > 0) {
    const { error: revokeError } = await adminSupabase
      .from('member_portal_links')
      .update({
        revoked_at: nowIso,
        updated_at: nowIso,
      })
      .in('id', activeLinkIds)

    if (revokeError) {
      return NextResponse.json({ message: revokeError.message }, { status: 500 })
    }
  }

  const portalToken = generateMemberPortalToken()
  const { data: portalLink, error: insertError } = await adminSupabase
    .from('member_portal_links')
    .insert({
      store_id: storeId,
      customer_id,
      token_hash: hashMemberPortalToken(portalToken),
      purpose: 'member_portal',
      expires_at: expiresAt,
      created_by_user_id: userId,
      updated_at: nowIso,
    })
    .select('id, expires_at')
    .single()

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 })
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: userId,
    entityType: 'member_portal_link',
    entityId: portalLink.id,
    action: 'created',
    after: {
      id: portalLink.id,
      customer_id,
      expires_at: portalLink.expires_at,
    },
    payload: {
      customer_id,
      customer_name: customer.full_name,
      expires_at: portalLink.expires_at,
      revoked_existing_count: activeLinkIds.length,
    },
  })

  const portalUrl = new URL(`/shared/member-portal/${portalToken}`, request.url).toString()

  return NextResponse.json({
    message: '会員証URLを発行しました。',
    portalUrl,
    expiresAt: portalLink.expires_at,
  })
}
