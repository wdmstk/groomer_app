import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStoreIdsByHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { isPlanAtLeast, normalizePlanCode } from '@/lib/subscription-plan'

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
  const candidateStoreIds = getStoreIdsByHqCapability(memberships, 'hq_view')
  if (candidateStoreIds.length === 0) {
    return {
      error: NextResponse.json(
        { message: 'Proプランの owner/admin 所属店舗がないため本部テンプレ機能を利用できません。' },
        { status: 403 }
      ),
    }
  }
  const { data: subscriptionRows } = await supabase
    .from('store_subscriptions')
    .select('store_id, plan_code')
    .in('store_id', candidateStoreIds)
  const manageableStoreIds = (subscriptionRows ?? [])
    .filter((row) => isPlanAtLeast(normalizePlanCode(row.plan_code as string | null), 'pro'))
    .map((row) => row.store_id as string)

  if (manageableStoreIds.length === 0) {
    return {
      error: NextResponse.json(
        { message: 'Proプランの owner/admin 所属店舗がないため本部テンプレ機能を利用できません。' },
        { status: 403 }
      ),
    }
  }

  return { supabase, manageableStoreIds, userId: user.id }
}

export async function GET(request: Request) {
  const resolved = await resolveManageableStores()
  if (resolved.error) return resolved.error
  const { supabase, manageableStoreIds } = resolved

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') ?? 'all').trim()

  let query = supabase
    .from('hq_menu_template_deliveries')
    .select(
      'id, source_store_id, target_store_ids, overwrite_scope, status, requested_by_user_id, approved_by_user_ids, applied_at, applied_summary, last_error, created_at'
    )
    .in('source_store_id', manageableStoreIds)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
