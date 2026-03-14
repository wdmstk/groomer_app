import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import {
  assertFollowupTaskInStore,
  FOLLOWUP_ALLOWED_STATUS_TRANSITIONS,
  FOLLOWUP_RESOLUTION_TYPES,
  FOLLOWUP_STATUSES,
  getFollowupRouteContext,
  isResolvedStatus,
  jsonError,
  toOptionalDate,
  toOptionalString,
} from '@/lib/followups/shared'
import type { Database, Json } from '@/lib/supabase/database.types'

type RouteParams = {
  params: Promise<{
    followup_id: string
  }>
}

type FollowupTaskUpdate = Database['public']['Tables']['customer_followup_tasks']['Update']
type FollowupEventInsert = Database['public']['Tables']['customer_followup_events']['Insert']

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { followup_id: followupId } = await params
  const { supabase, storeId, user } = allowed
  const taskCheck = await assertFollowupTaskInStore({ supabase, storeId, followupId })
  if ('error' in taskCheck) return taskCheck.error

  const body = await request.json().catch(() => null)
  const requestedStatus = toOptionalString(body?.status)
  const resolutionType = toOptionalString(body?.resolution_type)
  const resolutionNote = toOptionalString(body?.resolution_note)
  const snoozedUntil = toOptionalDate(body?.snoozed_until)
  const hasAssignedUserIdField =
    typeof body === 'object' &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, 'assigned_user_id')
  const assignedUserId = hasAssignedUserIdField
    ? body?.assigned_user_id === null
      ? null
      : toOptionalString(body?.assigned_user_id)
    : undefined

  if (requestedStatus && !FOLLOWUP_STATUSES.has(requestedStatus)) {
    return jsonError('有効な status を指定してください。', 400)
  }
  if (!requestedStatus && !hasAssignedUserIdField && !resolutionNote) {
    return jsonError('更新対象がありません。', 400)
  }

  const status = requestedStatus ?? taskCheck.data.status
  const currentStatus = taskCheck.data.status
  const isStatusChanged = status !== currentStatus
  if (isStatusChanged) {
    const allowedNext = FOLLOWUP_ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? new Set<string>()
    if (!allowedNext.has(status)) {
      return jsonError(
        `不正な status 遷移です: ${currentStatus} -> ${status}`,
        400
      )
    }
  }

  if (resolutionType && !FOLLOWUP_RESOLUTION_TYPES.has(resolutionType)) {
    return jsonError('有効な resolution_type を指定してください。', 400)
  }

  if (isStatusChanged && status === 'snoozed' && !snoozedUntil) {
    return jsonError('snoozed status では snoozed_until が必須です。', 400)
  }

  if (isStatusChanged && isResolvedStatus(status) && !resolutionType) {
    return jsonError('解決系 status では resolution_type が必須です。', 400)
  }

  if (typeof assignedUserId === 'string') {
    const { data: assignee, error: assigneeError } = await supabase
      .from('store_memberships')
      .select('user_id')
      .eq('store_id', storeId)
      .eq('user_id', assignedUserId)
      .eq('is_active', true)
      .maybeSingle()
    if (assigneeError) return jsonError(assigneeError.message, 500)
    if (!assignee) return jsonError('指定された担当者は店舗メンバーではありません。', 400)
  }

  const nowIso = new Date().toISOString()
  const payload: FollowupTaskUpdate = {
    status,
    snoozed_until: isStatusChanged
      ? status === 'snoozed'
        ? snoozedUntil
        : null
      : taskCheck.data.snoozed_until,
    resolved_at: isStatusChanged
      ? isResolvedStatus(status)
        ? nowIso
        : null
      : taskCheck.data.resolved_at,
    resolution_type: isStatusChanged
      ? isResolvedStatus(status)
        ? resolutionType
        : null
      : taskCheck.data.resolution_type,
    resolution_note: resolutionNote ?? taskCheck.data.resolution_note,
    assigned_user_id: hasAssignedUserIdField ? assignedUserId : taskCheck.data.assigned_user_id,
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

  const isAssigneeChanged = hasAssignedUserIdField && assignedUserId !== taskCheck.data.assigned_user_id
  const hasNoteOnly = !isStatusChanged && !isAssigneeChanged && Boolean(resolutionNote)
  const eventType = isStatusChanged
    ? isResolvedStatus(status)
      ? 'resolved'
      : status === 'snoozed'
        ? 'snoozed'
        : 'status_changed'
    : 'note_added'
  const eventPayload: FollowupEventInsert = {
    store_id: storeId,
    task_id: followupId,
    actor_user_id: user.id,
    event_type: eventType,
    payload: toJson({
      from_status: currentStatus,
      to_status: status,
      resolution_type: resolutionType,
      resolution_note: resolutionNote,
      snoozed_until: payload.snoozed_until,
      assigned_user_id: hasAssignedUserIdField ? assignedUserId : taskCheck.data.assigned_user_id,
      action: hasNoteOnly
        ? 'note_updated'
        : isAssigneeChanged
          ? 'assignee_updated'
          : isStatusChanged
            ? 'status_updated'
            : 'updated',
    }),
  }

  const { error: eventError } = await supabase.from('customer_followup_events').insert({
    ...eventPayload,
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
      from_status: currentStatus,
      to_status: status,
      event_type: eventType,
    },
  })

  return NextResponse.json({ task: data })
}
