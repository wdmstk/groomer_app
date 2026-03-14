import type { User } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  bootstrapStoreCore,
  StoreBootstrapServiceError,
} from '@/lib/stores/services/bootstrap-core'

function isStaffEmailDuplicateError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code ?? '') : ''
  const message = 'message' in error ? String(error.message ?? '') : ''
  return code === '23505' && message.includes('staffs_email_key')
}

function isStaffUserIdDuplicateError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code ?? '') : ''
  const message = 'message' in error ? String(error.message ?? '') : ''
  return code === '23505' && message.includes('staffs_user_id_unique')
}

async function insertOwnerStaff(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
  userId: string
  email: string | null
  fullName: string
}) {
  const payload = {
    store_id: params.storeId,
    user_id: params.userId,
    full_name: params.fullName,
    email: params.email,
    role: 'admin',
  }
  let { error } = await params.admin.from('staffs').insert(payload)

  if (error && isStaffEmailDuplicateError(error)) {
    const retry = await params.admin.from('staffs').insert({ ...payload, email: null })
    error = retry.error
  }

  if (error && isStaffUserIdDuplicateError(error)) {
    const retry = await params.admin.from('staffs').insert({ ...payload, user_id: null })
    error = retry.error
  }

  if (error && (isStaffEmailDuplicateError(error) || isStaffUserIdDuplicateError(error))) {
    const retry = await params.admin
      .from('staffs')
      .insert({ ...payload, email: null, user_id: null })
    error = retry.error
  }

  if (error) {
    throw new StoreBootstrapServiceError(error.message, 500)
  }
}

export { StoreBootstrapServiceError } from '@/lib/stores/services/bootstrap-core'

export async function bootstrapStore(params: {
  storeName: string
  user: User
  adminClient?: ReturnType<typeof createAdminSupabaseClient>
  trialDays?: number
  trialStartedAt?: string
}) {
  const admin = params.adminClient ?? createAdminSupabaseClient()
  const trialDaysValue = Number.isFinite(params.trialDays) ? Math.max(0, params.trialDays ?? 30) : 30
  const trialStartedAt = params.trialStartedAt ?? new Date().toISOString().slice(0, 10)

  return bootstrapStoreCore({
    storeName: params.storeName,
    user: params.user,
    trialDays: trialDaysValue,
    trialStartedAt,
    deps: {
      async fetchActiveMembershipRoles(userId) {
        const { data, error } = await admin
          .from('store_memberships')
          .select('role')
          .eq('user_id', userId)
          .eq('is_active', true)
        if (error) {
          throw new StoreBootstrapServiceError(error.message, 500)
        }
        return (data ?? []).map((row) => String(row.role))
      },
      async createStore(storeName) {
        const { data, error } = await admin
          .from('stores')
          .insert({
            name: storeName,
            timezone: 'Asia/Tokyo',
            is_active: true,
          })
          .select('id, name')
          .single()
        if (error || !data) {
          throw new StoreBootstrapServiceError(error?.message ?? '店舗作成に失敗しました。', 500)
        }
        return data
      },
      async upsertTrialSubscription({ storeId, trialDays, trialStartedAt }) {
        const { error } = await admin.from('store_subscriptions').upsert(
          {
            store_id: storeId,
            plan_code: 'light',
            billing_status: 'trialing',
            billing_cycle: 'monthly',
            amount_jpy: 0,
            trial_days: trialDays,
            trial_started_at: trialStartedAt,
          },
          { onConflict: 'store_id' }
        )
        if (error) {
          throw new StoreBootstrapServiceError(error.message, 500)
        }
      },
      async insertOwnerMembership({ storeId, userId }) {
        const { error } = await admin.from('store_memberships').insert({
          store_id: storeId,
          user_id: userId,
          role: 'owner',
          is_active: true,
        })
        if (error) {
          throw new StoreBootstrapServiceError(error.message, 500)
        }
      },
      async insertOwnerStaff({ storeId, userId, email, fullName }) {
        await insertOwnerStaff({ admin, storeId, userId, email, fullName })
      },
      async deleteStore(storeId) {
        await admin.from('stores').delete().eq('id', storeId)
      },
    },
  })
}
