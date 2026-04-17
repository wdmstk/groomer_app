import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'

type RouteContext = {
  params: Promise<{
    shift_id: string
  }>
}

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`
  return message.includes(relationName)
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const { shift_id: shiftId } = await context.params
  const db = toAnyClient(auth.supabase)

  let redirectTo: string | null = null
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const formData = await request.formData()
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const beforeResult = await db
    .from('staff_shift_plans')
    .select('id, staff_id, shift_date, status, start_at, end_at, planned_break_minutes, source_type, note')
    .eq('id', shiftId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (beforeResult.error) return NextResponse.json({ message: beforeResult.error.message }, { status: 500 })
  if (!beforeResult.data) return NextResponse.json({ message: '対象シフトが見つかりません。' }, { status: 404 })

  const { error } = await db
    .from('staff_shift_plans')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', shiftId)
    .eq('store_id', auth.storeId)

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  const afterResult = await db
    .from('staff_shift_plans')
    .select('id, staff_id, shift_date, status, start_at, end_at, planned_break_minutes, source_type, note')
    .eq('id', shiftId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (afterResult.error) return NextResponse.json({ message: afterResult.error.message }, { status: 500 })

  const runInsertResult = await db
    .from('shift_auto_generate_runs')
    .insert({
      store_id: auth.storeId,
      requested_by_user_id: auth.user.id,
      from_date: beforeResult.data.shift_date,
      to_date: beforeResult.data.shift_date,
      mode: 'apply_draft',
      settings_snapshot: { source: 'single_publish', shift_id: shiftId },
      summary: {
        mode: 'apply_draft',
        count: 1,
        applied: 1,
        created: 0,
        updated: 1,
        deleted: 0,
        skipped_manual: 0,
        policy_violations: 0,
        source: 'single_publish',
      },
    })
    .select('id')
    .maybeSingle()
  if (!runInsertResult.error) {
    const runId = runInsertResult.data?.id
    if (runId) {
      const { error: runItemsError } = await db.from('shift_auto_generate_run_items').insert({
        run_id: runId,
        store_id: auth.storeId,
        shift_date: beforeResult.data.shift_date,
        staff_id: beforeResult.data.staff_id,
        shift_plan_id: shiftId,
        action_type: 'updated',
        message: 'シフトを公開しました。',
        before_payload: beforeResult.data,
        after_payload: afterResult.data ?? {},
      })
      if (runItemsError && !isMissingRelationError(runItemsError, 'shift_auto_generate_run_items')) {
        return NextResponse.json({ message: runItemsError.message }, { status: 500 })
      }
    }
  } else if (!isMissingRelationError(runInsertResult.error, 'shift_auto_generate_runs')) {
    return NextResponse.json({ message: runInsertResult.error.message }, { status: 500 })
  }

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true })
}
