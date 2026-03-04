import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
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
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const allowed = await getCurrentMembership()
  if ('error' in allowed) return allowed.error

  const { customer_id } = await params
  const { supabase, storeId, userId } = allowed
  const adminSupabase = createAdminSupabaseClient()
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
    .select('id, expires_at, revoked_at')
    .eq('store_id', storeId)
    .eq('customer_id', customer_id)
    .eq('purpose', 'member_portal')
    .is('revoked_at', null)
    .gt('expires_at', nowIso)

  if (activeLinksError) {
    return NextResponse.json({ message: activeLinksError.message }, { status: 500 })
  }

  if (!activeLinks || activeLinks.length === 0) {
    return NextResponse.json({ message: '有効な会員証URLはありません。' })
  }

  const targetIds = activeLinks.map((row) => row.id as string)
  const { error: revokeError } = await adminSupabase
    .from('member_portal_links')
    .update({
      revoked_at: nowIso,
      updated_at: nowIso,
    })
    .in('id', targetIds)

  if (revokeError) {
    return NextResponse.json({ message: revokeError.message }, { status: 500 })
  }

  await Promise.all(
    activeLinks.map((row) =>
      insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: userId,
        entityType: 'member_portal_link',
        entityId: row.id as string,
        action: 'revoked',
        before: row,
        after: {
          ...(row as Record<string, unknown>),
          revoked_at: nowIso,
        },
        payload: {
          customer_id,
          customer_name: customer.full_name,
        },
      })
    )
  )

  return NextResponse.json({ message: '会員証URLを無効化しました。' })
}
