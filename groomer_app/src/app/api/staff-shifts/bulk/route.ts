import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { parseDateKey, resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'

type BulkActionType = 'publish' | 'unpublish' | 'delete'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function parseActionType(value: string | null | undefined): BulkActionType | null {
  if (value === 'publish' || value === 'unpublish' || value === 'delete') return value
  return null
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`
  return message.includes(relationName)
}

export async function POST(request: Request) {
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
    const bodyRaw: unknown = await request.json()
    payload = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    payload = {
      action_type: formData.get('action_type')?.toString() ?? '',
      from_date: formData.get('from_date')?.toString() ?? '',
      to_date: formData.get('to_date')?.toString() ?? '',
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const actionType = parseActionType(String(payload.action_type ?? ''))
  const fromDate = parseDateKey(String(payload.from_date ?? ''))
  const toDate = parseDateKey(String(payload.to_date ?? ''))
  if (!actionType) {
    return NextResponse.json({ message: 'action_type は publish/unpublish/delete を指定してください。' }, { status: 400 })
  }
  if (!fromDate || !toDate) {
    return NextResponse.json({ message: 'from_date/to_date は必須です。' }, { status: 400 })
  }
  if (toDate < fromDate) {
    return NextResponse.json({ message: 'to_date は from_date 以降で指定してください。' }, { status: 400 })
  }

  const selectResult = await db
    .from('staff_shift_plans')
    .select('id, staff_id, shift_date, status, start_at, end_at, planned_break_minutes, source_type, note')
    .eq('store_id', auth.storeId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)

  if (selectResult.error) {
    return NextResponse.json({ message: selectResult.error.message }, { status: 500 })
  }

  const targetRows = (selectResult.data ?? []) as Array<{
    id: string
    staff_id: string | null
    shift_date: string
    status: string
    start_at: string
    end_at: string
    planned_break_minutes: number
    source_type: string
    note: string | null
  }>
  const targetIds = targetRows
    .map((row) => row.id)
    .filter((id: string | null | undefined): id is string => typeof id === 'string' && id.length > 0)

  if (targetIds.length > 0) {
    if (actionType === 'delete') {
      const { error } = await db
        .from('staff_shift_plans')
        .delete()
        .eq('store_id', auth.storeId)
        .in('id', targetIds)
      if (error) return NextResponse.json({ message: error.message }, { status: 500 })
    } else {
      const { error } = await db
        .from('staff_shift_plans')
        .update({ status: actionType === 'publish' ? 'published' : 'draft', updated_at: new Date().toISOString() })
        .eq('store_id', auth.storeId)
        .in('id', targetIds)
      if (error) return NextResponse.json({ message: error.message }, { status: 500 })
    }
  }

  const nowIso = new Date().toISOString()
  const runSummary = {
    mode: 'apply_draft',
    from_date: fromDate,
    to_date: toDate,
    count: targetIds.length,
    applied: targetIds.length,
    created: 0,
    updated: actionType === 'delete' ? 0 : targetIds.length,
    deleted: actionType === 'delete' ? targetIds.length : 0,
    skipped_manual: 0,
    policy_violations: 0,
    source: `bulk_${actionType}`,
  }
  let runId: string | null = null
  const runInsertResult = await db
    .from('shift_auto_generate_runs')
    .insert({
      store_id: auth.storeId,
      requested_by_user_id: auth.user.id,
      from_date: fromDate,
      to_date: toDate,
      mode: 'apply_draft',
      settings_snapshot: { source: 'bulk_action', action_type: actionType },
      summary: runSummary,
    })
    .select('id')
    .maybeSingle()
  if (!runInsertResult.error) {
    runId = runInsertResult.data?.id ?? null
  } else if (!isMissingRelationError(runInsertResult.error, 'shift_auto_generate_runs')) {
    return NextResponse.json({ message: runInsertResult.error.message }, { status: 500 })
  }

  if (runId && targetRows.length > 0) {
    const runItems = targetRows.map((row) => ({
      run_id: runId as string,
      store_id: auth.storeId,
      shift_date: row.shift_date,
      staff_id: row.staff_id,
      shift_plan_id: actionType === 'delete' ? null : row.id,
      action_type: actionType === 'delete' ? 'deleted' : 'updated',
      message:
        actionType === 'delete'
          ? '一括操作でシフトを削除しました。'
          : actionType === 'publish'
            ? '一括操作でシフトを公開しました。'
            : '一括操作でシフトを非公開にしました。',
      before_payload: row,
      after_payload: actionType === 'delete' ? {} : { ...row, status: actionType === 'publish' ? 'published' : 'draft', updated_at: nowIso },
    }))
    const { error: runItemsError } = await db.from('shift_auto_generate_run_items').insert(runItems)
    if (runItemsError && !isMissingRelationError(runItemsError, 'shift_auto_generate_run_items')) {
      return NextResponse.json({ message: runItemsError.message }, { status: 500 })
    }
  }

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true, data: { affected_count: targetIds.length } })
}
