import { NextResponse } from 'next/server'
import { requireStoreMembershipWithPlan } from '@/lib/auth/store-membership'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import {
  parseDateKey,
  parseDateTimeJst,
  parseInteger,
  resolveSafeRedirectTo,
} from '@/lib/staff-shifts/shared'

type RouteContext = {
  params: Promise<{
    shift_id: string
  }>
}

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function normalizeSourceType(value: string | null | undefined) {
  if (value === 'auto' || value === 'nomination_sync') return value
  return 'manual'
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = `${(error as { message?: string } | null)?.message ?? ''}`
  return message.includes(relationName)
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const { shift_id: shiftId } = await context.params
  const db = toAnyClient(auth.supabase)

  const bodyRaw: unknown = await request.json()
  const payload = asObject(bodyRaw)
  const patch: UnknownObject = {
    updated_at: new Date().toISOString(),
  }

  const shiftDate = parseDateKey(String(payload.shift_date ?? ''))
  const startTime = String(payload.start_time ?? '').trim()
  const endTime = String(payload.end_time ?? '').trim()
  if (shiftDate && startTime && endTime) {
    const startAt = parseDateTimeJst(shiftDate, startTime)
    const endAt = parseDateTimeJst(shiftDate, endTime)
    if (!startAt || !endAt || startAt >= endAt) {
      return NextResponse.json({ message: '開始・終了時刻が不正です。' }, { status: 400 })
    }
    patch.shift_date = shiftDate
    patch.start_at = startAt
    patch.end_at = endAt
  }

  if (typeof payload.planned_break_minutes !== 'undefined') {
    patch.planned_break_minutes = Math.max(0, parseInteger(String(payload.planned_break_minutes), 0))
  }
  if (typeof payload.note === 'string') {
    patch.note = payload.note || null
  }
  if (typeof payload.status === 'string' && (payload.status === 'draft' || payload.status === 'published')) {
    patch.status = payload.status
  }
  if (typeof payload.source_type === 'string') {
    patch.source_type = normalizeSourceType(payload.source_type)
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
    .update(patch)
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
      settings_snapshot: { source: 'single_edit', shift_id: shiftId },
      summary: {
        mode: 'apply_draft',
        count: 1,
        applied: 1,
        created: 0,
        updated: 1,
        deleted: 0,
        skipped_manual: 0,
        policy_violations: 0,
        source: 'single_edit',
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
        message: 'シフトを更新しました。',
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

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireStoreMembershipWithPlan({
    allowedRoles: ['owner', 'admin'],
    minimumPlan: 'standard',
    featureLabel: 'シフト管理',
  })
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const { shift_id: shiftId } = await context.params
  const db = toAnyClient(auth.supabase)

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
    .delete()
    .eq('id', shiftId)
    .eq('store_id', auth.storeId)
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  const runInsertResult = await db
    .from('shift_auto_generate_runs')
    .insert({
      store_id: auth.storeId,
      requested_by_user_id: auth.user.id,
      from_date: beforeResult.data.shift_date,
      to_date: beforeResult.data.shift_date,
      mode: 'apply_draft',
      settings_snapshot: { source: 'single_delete', shift_id: shiftId },
      summary: {
        mode: 'apply_draft',
        count: 1,
        applied: 1,
        created: 0,
        updated: 0,
        deleted: 1,
        skipped_manual: 0,
        policy_violations: 0,
        source: 'single_delete',
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
        shift_plan_id: null,
        action_type: 'deleted',
        message: 'シフトを削除しました。',
        before_payload: beforeResult.data,
        after_payload: {},
      })
      if (runItemsError && !isMissingRelationError(runItemsError, 'shift_auto_generate_run_items')) {
        return NextResponse.json({ message: runItemsError.message }, { status: 500 })
      }
    }
  } else if (!isMissingRelationError(runInsertResult.error, 'shift_auto_generate_runs')) {
    return NextResponse.json({ message: runInsertResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request, context: RouteContext) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? '/staffs?tab=shift')

  if (method === 'delete') {
    const res = await DELETE(request, context)
    if (redirectTo && res.ok) return NextResponse.redirect(new URL(redirectTo, request.url))
    return res
  }

  const body: UnknownObject = {}
  const shiftDate = formData.get('shift_date')?.toString()
  const startTime = formData.get('start_time')?.toString()
  const endTime = formData.get('end_time')?.toString()
  const plannedBreakMinutes = formData.get('planned_break_minutes')?.toString()
  const note = formData.get('note')?.toString()
  const sourceType = formData.get('source_type')?.toString()
  const status = formData.get('status')?.toString()

  if (shiftDate) body.shift_date = shiftDate
  if (startTime) body.start_time = startTime
  if (endTime) body.end_time = endTime
  if (typeof plannedBreakMinutes === 'string') body.planned_break_minutes = plannedBreakMinutes
  if (typeof note === 'string') body.note = note
  if (sourceType) body.source_type = sourceType
  if (status) body.status = status

  const patchedRequest = new Request(request.url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await PATCH(patchedRequest, context)
  if (redirectTo && res.ok) return NextResponse.redirect(new URL(redirectTo, request.url))
  return res
}
