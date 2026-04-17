import { createStoreScopedClient } from '@/lib/supabase/store'
import { type AppPlan, isPlanAtLeast } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'

export type StoreRole = 'owner' | 'admin' | 'staff'

type RequireMembershipResult =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
      storeId: string
      user: { id: string }
      role: StoreRole
    }
  | {
      ok: false
      status: number
      message: string
    }

export async function requireStoreMembership(allowedRoles?: StoreRole[]): Promise<RequireMembershipResult> {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false,
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
      ok: false,
      status: 500,
      message: membershipError.message,
    }
  }

  if (!membership) {
    return {
      ok: false,
      status: 403,
      message: '店舗所属が確認できません。',
    }
  }

  const role = membership.role as StoreRole
  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      ok: false,
      status: 403,
      message: `この操作は ${allowedRoles.join('/')} のみ実行できます。`,
    }
  }

  return {
    ok: true,
    supabase,
    storeId,
    user: { id: user.id },
    role,
  }
}

export async function requireStoreMembershipWithPlan(
  params: {
    allowedRoles?: StoreRole[]
    minimumPlan: AppPlan
    featureLabel?: string
  }
): Promise<RequireMembershipResult> {
  const auth = await requireStoreMembership(params.allowedRoles)
  if (!auth.ok) return auth

  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(auth.supabase),
    storeId: auth.storeId,
  })
  if (!isPlanAtLeast(planState.planCode, params.minimumPlan)) {
    const featureLabel = (params.featureLabel ?? '').trim()
    const message = featureLabel
      ? `${featureLabel}は${params.minimumPlan === 'standard' ? 'スタンダード' : 'プロ'}以上で利用できます。`
      : `${params.minimumPlan === 'standard' ? 'スタンダード' : 'プロ'}以上のプランで利用できます。`
    return {
      ok: false,
      status: 403,
      message,
    }
  }

  return auth
}
