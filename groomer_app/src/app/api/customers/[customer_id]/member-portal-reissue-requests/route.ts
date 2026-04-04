import { NextResponse } from 'next/server'
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

export async function GET(_: Request, { params }: RouteParams) {
  const allowed = await getCurrentMembership()
  if ('error' in allowed) return allowed.error

  const { customer_id } = await params
  const { storeId } = allowed
  const admin = createAdminSupabaseClient()

  const { data: row, error } = await admin
    .from('member_portal_reissue_requests' as never)
    .select('id, status, requested_at, request_note' as never)
    .eq('store_id', storeId)
    .eq('customer_id', customer_id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  const pendingRow = row as
    | {
        id: string
        status: string
        requested_at: string | null
        request_note: string | null
      }
    | null

  return NextResponse.json({
    pendingRequest: pendingRow
      ? {
          id: pendingRow.id,
          status: pendingRow.status,
          requestedAt: pendingRow.requested_at,
          note: pendingRow.request_note,
        }
      : null,
  })
}
