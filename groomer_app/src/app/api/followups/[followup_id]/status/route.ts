import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
  assertFollowupTaskInStore,
  FOLLOWUP_RESOLUTION_TYPES,
  FOLLOWUP_STATUSES,
  getFollowupRouteContext,
  isResolvedStatus,
  jsonError,
  toOptionalDate,
  toOptionalString,
} from '@/lib/followups/shared'

type RouteParams = {
  params: Promise<{
    followup_id: string
  }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { followup_id: followupId } = await params
  const { supabase, storeId, user } = allowed
  const taskCheck = await assertFollowupTaskInStore({ supabase, storeId, followupId })
  if ('error' in taskCheck) return taskCheck.error

  const body = await request.json().catch(() => null)
  const status = toOptionalString(body?.status)
  const resolutionType = toOptionalString(body?.resolution_type)
  const resolutionNote = toOptionalString(body?.resolution_note)
  const snoozedUntil = toOptionalDate(body?.snoozed_until)
  const assignedUserId = toOptionalString(body?.assigned_user_id)

  if (!status || !FOLLOWUP_STATUSES.has(status)) {
    return jsonError('有効な status を指定してください。', 400)
  }

  if (resolutionType && !FOLLOWUP_RESOLUTION_TYPES.has(resolutionType)) {
    return jsonError('有効な resolution_type を指定してください。', 400)
  }

  if (status === 'snoozed' && !snoozedUntil) {
    return jsonError('snoozed status では snoozed_until が必須です。', 400)
  }

  if (isResolvedStatus(status) && !resolutionType) {
    return jsonError('解決系 status では resolution_type が必須です。', 400)
  }

  const nowIso = new Date().toISOString()
  const payload = {
    status,
    snoozed_until: status === 'snoozed' ? snoozedUntil : null,
    resolved_at: isResolvedStatus(status) ? nowIso : null,
    resolution_type: isResolvedStatus(status) ? resolutionType : null,
    resolution_note: resolutionNote,
    assigned_user_id: assignedUserId,
    updated_at: nowIso,
  }

  const { data, error } = await supabase
    .from('customer_followup_tasks')
    .update(payload)
    .eq('id', followupId)
    .eq('store_id', storeId)
    .select(
      'id, status, snoozed_until, resolved_at, resolution_type, resolution_note, updated_at'
    )
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  const eventType = isResolvedStatus(status) ? 'resolved' : status === 'snoozed' ? 'snoozed' : 'status_changed'
  const { error: eventError } = await supabase.from('customer_followup_events').insert({
    store_id: storeId,
    task_id: followupId,
    actor_user_id: user.id,
    event_type: eventType,
    payload: {
      from_status: taskCheck.data.status,
      to_status: status,
      resolution_type: resolutionType,
      resolution_note: resolutionNote,
      snoozed_until: payload.snoozed_until,
      assigned_user_id: assignedUserId,
    },
  })

  if (eventError) {
    return jsonError(eventError.message, 500)
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user.id,
    entityType: 'followup_task',
    entityId: followupId,
    action: 'status_changed',
    before: taskCheck.data,
    after: data,
    payload: {
      from_status: taskCheck.data.status,
      to_status: status,
      event_type: eventType,
    },
  })

  return NextResponse.json({ task: data })
}
