import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createStoreScopedClient } from '@/lib/supabase/store'

type StoreRole = 'owner' | 'admin' | 'staff'

export async function requireStoreSupportChatAccess() {
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

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      message: '店舗メンバーのみ利用できます。',
    }
  }

  if ((membership.role as StoreRole) === 'owner') {
    return {
      ok: true as const,
      storeId,
      user,
      role: membership.role as StoreRole,
    }
  }

  const admin = createAdminSupabaseClient()
  const { data: participant, error: participantError } = await admin
    .from('store_chat_participants')
    .select('can_participate')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (participantError) {
    return {
      ok: false as const,
      status: 500,
      message: participantError.message,
    }
  }

  if (!participant?.can_participate) {
    return {
      ok: false as const,
      status: 403,
      message: 'チャット参加権限がありません。オーナーに設定を依頼してください。',
    }
  }

  return {
    ok: true as const,
    storeId,
    user,
    role: membership.role as StoreRole,
  }
}
