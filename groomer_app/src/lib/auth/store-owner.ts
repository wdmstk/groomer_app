import { createStoreScopedClient } from '@/lib/supabase/store'

export async function requireOwnerStoreMembership() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      message: 'Unauthorized',
    }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    return {
      ok: false as const,
      status: 500,
      message: membershipError.message,
    }
  }

  if (!membership || membership.role !== 'owner') {
    return {
      ok: false as const,
      status: 403,
      message: 'この操作は店舗ownerのみ実行できます。',
    }
  }

  return {
    ok: true as const,
    supabase,
    storeId,
    user,
  }
}
