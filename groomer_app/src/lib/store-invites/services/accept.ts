import type { User } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  acceptStoreInviteCore,
  StoreInviteAcceptServiceError,
} from '@/lib/store-invites/services/accept-core'

export { StoreInviteAcceptServiceError } from '@/lib/store-invites/services/accept-core'

export async function acceptStoreInvite(params: {
  token: string
  user: User
  adminClient?: ReturnType<typeof createAdminSupabaseClient>
  nowIso?: string
}) {
  const admin = params.adminClient ?? createAdminSupabaseClient()
  const nowIso = params.nowIso ?? new Date().toISOString()

  return acceptStoreInviteCore({
    token: params.token,
    user: params.user,
    nowIso,
    deps: {
      async fetchInviteByToken(token) {
        const { data: invite, error } = await admin
          .from('store_invites')
          .select('id, store_id, email, role, expires_at, used_at')
          .eq('token', token)
          .maybeSingle()
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
        return invite
      },
      async upsertMembership({ storeId, userId, role }) {
        const { error } = await admin.from('store_memberships').upsert(
          {
            store_id: storeId,
            user_id: userId,
            role,
            is_active: true,
          },
          { onConflict: 'store_id,user_id' }
        )
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
      },
      async findStaffByUserId({ storeId, userId }) {
        const { data, error } = await admin
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
        return data
      },
      async findStaffByEmail({ storeId, email }) {
        const { data, error } = await admin
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .ilike('email', email)
          .limit(1)
          .maybeSingle()
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
        return data
      },
      async updateStaffById({ staffId, payload }) {
        const { error } = await admin.from('staffs').update(payload).eq('id', staffId)
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
      },
      async insertStaff({ storeId, payload }) {
        const { error } = await admin.from('staffs').insert({
          store_id: storeId,
          ...payload,
        })
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
      },
      async consumeInvite({ inviteId, usedAt, usedBy }) {
        const { error } = await admin
          .from('store_invites')
          .update({ used_at: usedAt, used_by: usedBy })
          .eq('id', inviteId)
        if (error) {
          throw new StoreInviteAcceptServiceError(error.message, 500)
        }
      },
    },
  })
}
