import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { isPlanAtLeast } from '@/lib/subscription-plan'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import {
  DEFAULT_OPTIMIZATION_WEIGHTS,
  hasValidWeightSum,
  normalizeWeights,
  sumWeights,
} from '@/lib/staff-shifts/optimization'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`
  return message.includes(relationName)
}

function hasOwnKey(object: UnknownObject, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export async function GET() {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const db = toAnyClient(auth.supabase)
  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(auth.supabase),
    storeId: auth.storeId,
  })
  const isPro = isPlanAtLeast(planState.planCode, 'pro')

  const [settingsResult, profileResult] = await Promise.all([
    db
      .from('store_shift_settings')
      .select('shift_optimization_enabled, scheduled_auto_run_enabled')
      .eq('store_id', auth.storeId)
      .maybeSingle(),
    db
      .from('shift_optimization_profiles')
      .select('fairness_weight, preferred_shift_weight, reservation_coverage_weight, workload_health_weight')
      .eq('store_id', auth.storeId)
      .maybeSingle(),
  ])

  if (settingsResult.error && !isMissingRelationError(settingsResult.error, 'store_shift_settings')) {
    return NextResponse.json({ message: settingsResult.error.message }, { status: 500 })
  }
  if (profileResult.error && !isMissingRelationError(profileResult.error, 'shift_optimization_profiles')) {
    return NextResponse.json({ message: profileResult.error.message }, { status: 500 })
  }

  const weights = normalizeWeights(profileResult.data)
  return NextResponse.json({
    ok: true,
    data: {
      enabled: Boolean(settingsResult.data?.shift_optimization_enabled ?? false),
      scheduled_auto_run_enabled: Boolean(settingsResult.data?.scheduled_auto_run_enabled ?? false),
      weights,
      can_edit: isPro,
      plan_code: planState.planCode,
    },
  })
}

export async function PUT(request: Request) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const db = toAnyClient(auth.supabase)
  const contentType = request.headers.get('content-type') ?? ''
  let payload: UnknownObject = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    payload = asObject(await request.json())
  } else {
    const formData = await request.formData()
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
    const nextPayload: UnknownObject = {}
    if (formData.has('shift_optimization_enabled')) {
      const values = formData.getAll('shift_optimization_enabled').map((v) => v.toString())
      nextPayload.shift_optimization_enabled = values.some((v) => v === '1' || v === 'true' || v === 'on')
    }
    if (formData.has('scheduled_auto_run_enabled')) {
      const values = formData.getAll('scheduled_auto_run_enabled').map((v) => v.toString())
      nextPayload.scheduled_auto_run_enabled = values.some((v) => v === '1' || v === 'true' || v === 'on')
    }
    if (formData.has('fairness_weight')) nextPayload.fairness_weight = formData.get('fairness_weight')?.toString() ?? ''
    if (formData.has('preferred_shift_weight')) nextPayload.preferred_shift_weight = formData.get('preferred_shift_weight')?.toString() ?? ''
    if (formData.has('reservation_coverage_weight')) nextPayload.reservation_coverage_weight = formData.get('reservation_coverage_weight')?.toString() ?? ''
    if (formData.has('workload_health_weight')) nextPayload.workload_health_weight = formData.get('workload_health_weight')?.toString() ?? ''
    payload = nextPayload
  }

  const shouldEnableOptimization = hasOwnKey(payload, 'shift_optimization_enabled')
  const shouldEnableScheduled = hasOwnKey(payload, 'scheduled_auto_run_enabled')
  const shouldUpdateWeights =
    hasOwnKey(payload, 'fairness_weight') ||
    hasOwnKey(payload, 'preferred_shift_weight') ||
    hasOwnKey(payload, 'reservation_coverage_weight') ||
    hasOwnKey(payload, 'workload_health_weight')

  const shiftOptimizationEnabled =
    payload.shift_optimization_enabled === true ||
    payload.shift_optimization_enabled === '1' ||
    payload.shift_optimization_enabled === 'true' ||
    payload.shift_optimization_enabled === 'on'

  const scheduledAutoRunEnabled =
    payload.scheduled_auto_run_enabled === true ||
    payload.scheduled_auto_run_enabled === '1' ||
    payload.scheduled_auto_run_enabled === 'true' ||
    payload.scheduled_auto_run_enabled === 'on'

  const weights = normalizeWeights({
    fairness_weight: payload.fairness_weight,
    preferred_shift_weight: payload.preferred_shift_weight,
    reservation_coverage_weight: payload.reservation_coverage_weight,
    workload_health_weight: payload.workload_health_weight,
  })

  if (shouldUpdateWeights && !hasValidWeightSum(weights)) {
    return NextResponse.json(
      {
        message: `重み合計は1.0にしてください（現在: ${sumWeights(weights).toFixed(4)}）。`,
      },
      { status: 400 }
    )
  }

  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(auth.supabase),
    storeId: auth.storeId,
  })
  const isPro = isPlanAtLeast(planState.planCode, 'pro')

  if (!isPro && (shiftOptimizationEnabled || scheduledAutoRunEnabled || shouldUpdateWeights)) {
    return NextResponse.json(
      {
        message: 'シフト最適化と定期自動運転はプロプランで利用できます。',
      },
      { status: 403 }
    )
  }

  if (shouldEnableOptimization || shouldEnableScheduled) {
    const { error: settingsError } = await db.from('store_shift_settings').upsert(
      {
        store_id: auth.storeId,
        shift_optimization_enabled: shiftOptimizationEnabled,
        scheduled_auto_run_enabled: scheduledAutoRunEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id' }
    )
    if (settingsError) return NextResponse.json({ message: settingsError.message }, { status: 500 })
  }

  if (shouldUpdateWeights) {
    const { error: profileError } = await db.from('shift_optimization_profiles').upsert(
      {
        store_id: auth.storeId,
        ...weights,
        updated_by_user_id: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id' }
    )
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 })
  }

  const responseBody = {
    ok: true,
    data: {
      enabled: shiftOptimizationEnabled,
      scheduled_auto_run_enabled: scheduledAutoRunEnabled,
      weights: shouldUpdateWeights ? weights : DEFAULT_OPTIMIZATION_WEIGHTS,
    },
  }
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }
  return NextResponse.json(responseBody)
}

export async function POST(request: Request) {
  return PUT(request)
}
