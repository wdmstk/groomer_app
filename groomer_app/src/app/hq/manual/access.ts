import { canRoleUseHqCapability, type MembershipRow } from '@/lib/auth/hq-access'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type HqManualAccessResult =
  | { ok: true }
  | {
      ok: false
      message: string
    }

export async function requireHqManualAccess(): Promise<HqManualAccessResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'ログインが必要です。' }
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipsError) {
    return { ok: false, message: membershipsError.message }
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const manageableStores = memberships.filter((row) => canRoleUseHqCapability(row.role, 'hq_view'))
  if (manageableStores.length === 0) {
    return { ok: false, message: '本部マニュアルは owner/admin 権限のユーザーのみ利用できます。' }
  }

  return { ok: true }
}
