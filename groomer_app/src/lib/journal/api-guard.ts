import { createStoreScopedClient } from '@/lib/supabase/store'
import { isJournalFeatureEnabledForStore } from '@/lib/journal/feature-gate'
import { resolveJournalPermissions, type JournalPermissions } from '@/lib/journal/permissions'

export type JournalStoreContext =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
      storeId: string
      userId: string
      staffId: string | null
      role: string
      permissions: JournalPermissions
    }
  | {
      ok: false
      status: number
      message: string
    }

export async function requireJournalStoreContext(): Promise<JournalStoreContext> {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return { ok: false, status: 403, message: membershipError?.message ?? 'Forbidden' }
  }

  if (!isJournalFeatureEnabledForStore(storeId)) {
    return {
      ok: false,
      status: 403,
      message: 'Journal feature is not enabled for this store.',
    }
  }

  const { data: staffRow } = await supabase
    .from('staffs')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const role = String(membership.role ?? '')
  const permissions = await resolveJournalPermissions({
    supabase,
    storeId,
    role,
  })

  return {
    ok: true,
    supabase,
    storeId,
    userId: user.id,
    staffId: (staffRow?.id as string | null) ?? null,
    role,
    permissions,
  }
}
