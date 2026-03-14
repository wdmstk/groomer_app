import { NextResponse } from 'next/server'
import { getDefaultFollowupLineTemplate } from '@/lib/notification-templates'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { JsonObject } from '@/lib/object-utils'
import {
  FOLLOWUP_STATUSES,
  getFollowupRouteContext,
  isResolvedStatus,
  jsonError,
  toOptionalDate,
  toOptionalDateOnly,
  toOptionalString,
} from '@/lib/followups/shared'

const REVISIT_CYCLE_DAYS = 45

type FollowupTaskInsert = Database['public']['Tables']['customer_followup_tasks']['Insert']
type FollowupEventInsert = Database['public']['Tables']['customer_followup_events']['Insert']
type FollowupTaskLike = JsonObject & { id: string; assigned_user_id?: Json }

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

function addDays(value: string, days: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function resolveBooleanFlag(value: string | null) {
  return value === 'true' || value === '1'
}

export async function GET(request: Request) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { supabase, storeId } = allowed
  const searchParams = new URL(request.url).searchParams
  const requestedStatus = toOptionalString(searchParams.get('status'))
  const assignee = toOptionalString(searchParams.get('assignee'))
  const due = toOptionalString(searchParams.get('due')) ?? 'all'
  const includeCandidates = resolveBooleanFlag(searchParams.get('include_candidates'))
  const windowDays = (() => {
    const raw = toOptionalString(searchParams.get('window_days'))
    if (!raw || raw === 'all') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  })()

  let taskQuery = supabase
    .from('customer_followup_tasks')
    .select(
      'id, customer_id, pet_id, source_appointment_id, last_visit_at, recommended_at, status, priority, due_on, snoozed_until, assigned_user_id, resolved_at, resolution_type, resolution_note, last_contacted_at, last_contact_method, updated_at, customers(full_name, phone_number, line_id), pets(name)'
    )
    .eq('store_id', storeId)
    .order('recommended_at', { ascending: true })

  if (windowDays !== null) {
    const fromIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    taskQuery = taskQuery.gte('recommended_at', fromIso)
  }

  if (requestedStatus && FOLLOWUP_STATUSES.has(requestedStatus)) {
    taskQuery = taskQuery.eq('status', requestedStatus)
  }

  if (assignee === 'me') {
    taskQuery = taskQuery.eq('assigned_user_id', allowed.user.id)
  } else if (assignee) {
    taskQuery = taskQuery.eq('assigned_user_id', assignee)
  }

  const today = new Date().toISOString().slice(0, 10)
  if (due === 'today') {
    taskQuery = taskQuery.eq('due_on', today)
  } else if (due === 'overdue') {
    taskQuery = taskQuery.lt('due_on', today)
  }

  const { data: tasks, error: tasksError } = await taskQuery
  if (tasksError) {
    return jsonError(tasksError.message, 500)
  }

  const taskIds = ((tasks ?? []) as Array<{ id: string }>).map((task) => task.id)
  const [
    { data: taskEvents, error: taskEventsError },
    { data: staffRows, error: staffRowsError },
    { data: templateRows, error: templateError },
  ] =
    taskIds.length > 0
      ? await Promise.all([
          supabase
            .from('customer_followup_events')
            .select('id, task_id, actor_user_id, event_type, payload, created_at')
            .eq('store_id', storeId)
            .in('task_id', taskIds)
            .order('created_at', { ascending: false }),
          supabase.from('staffs').select('id, user_id, full_name').eq('store_id', storeId),
          supabase
            .from('notification_templates')
            .select('template_key, body')
            .eq('store_id', storeId)
            .eq('channel', 'line')
            .eq('is_active', true)
            .eq('template_key', 'followup_line'),
        ])
      : await Promise.all([
          Promise.resolve({ data: [] as JsonObject[], error: null }),
          supabase.from('staffs').select('id, user_id, full_name').eq('store_id', storeId),
          supabase
            .from('notification_templates')
            .select('template_key, body')
            .eq('store_id', storeId)
            .eq('channel', 'line')
            .eq('is_active', true)
            .eq('template_key', 'followup_line'),
        ])

  if (taskEventsError || staffRowsError || (templateError && !templateError.message.includes('notification_templates'))) {
    return jsonError(
      taskEventsError?.message ??
        staffRowsError?.message ??
        templateError?.message ??
        'Failed to fetch followup metadata.',
      500
    )
  }
  const followupTemplate =
    ((templateRows ?? []) as Array<{ template_key: string; body: string }>)[0]?.body ??
    getDefaultFollowupLineTemplate()

  const staffNameByUserId = new Map(
    ((staffRows ?? []) as Array<{ id: string; user_id: string | null; full_name: string }>)
      .filter((row) => Boolean(row.user_id))
      .map((row) => [row.user_id as string, row.full_name])
  )
  const eventsByTaskId = new Map<string, JsonObject[]>()
  ;((taskEvents ?? []) as Array<{
    id: string
    task_id: string
    actor_user_id: string | null
    event_type: string
    payload: JsonObject
    created_at: string
  }>).forEach((event) => {
    const current = eventsByTaskId.get(event.task_id) ?? []
    current.push({
      ...event,
      actor_name: event.actor_user_id ? staffNameByUserId.get(event.actor_user_id) ?? null : null,
    })
    eventsByTaskId.set(event.task_id, current)
  })

  if (!includeCandidates) {
    return NextResponse.json({
      tasks: ((tasks ?? []) as FollowupTaskLike[]).map((task) => ({
        ...task,
        assignee_name:
          task.assigned_user_id && typeof task.assigned_user_id === 'string'
            ? staffNameByUserId.get(task.assigned_user_id) ?? null
            : null,
        events: eventsByTaskId.get(task.id) ?? [],
      })),
      candidates: [],
      assignees: ((staffRows ?? []) as Array<{ user_id: string | null; full_name: string }>)
        .filter((row) => Boolean(row.user_id))
        .map((row) => ({ user_id: row.user_id as string, full_name: row.full_name })),
      templates: {
        followup_line: {
          body: followupTemplate,
        },
      },
    })
  }

  const [{ data: customers, error: customersError }, { data: visits, error: visitsError }, { data: appointments, error: appointmentsError }, { data: activeTasks, error: activeTasksError }, { data: staffs, error: staffsError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, phone_number, line_id')
        .eq('store_id', storeId),
      supabase
        .from('visits')
        .select('customer_id, visit_date, appointment_id')
        .eq('store_id', storeId)
        .order('visit_date', { ascending: false }),
      supabase
        .from('appointments')
        .select('id, customer_id, pet_id, staff_id, start_time, status')
        .eq('store_id', storeId),
      supabase
        .from('customer_followup_tasks')
        .select('customer_id, snoozed_until, status')
        .eq('store_id', storeId),
      supabase
        .from('staffs')
        .select('id, user_id, full_name')
        .eq('store_id', storeId),
    ])

  const firstError = customersError ?? visitsError ?? appointmentsError ?? activeTasksError ?? staffsError
  if (firstError) {
    return jsonError(firstError.message, 500)
  }

  const lastVisitByCustomerId = new Map<string, { visitDate: string; appointmentId: string | null }>()
  ;((visits ?? []) as Array<{ customer_id: string | null; visit_date: string; appointment_id: string | null }>).forEach((row) => {
    if (!row.customer_id || lastVisitByCustomerId.has(row.customer_id)) return
    lastVisitByCustomerId.set(row.customer_id, {
      visitDate: row.visit_date,
      appointmentId: row.appointment_id,
    })
  })

  const nowMs = Date.now()
  const staffByStaffId = new Map(
    ((staffs ?? []) as Array<{ id: string; user_id: string | null; full_name: string }>).map((row) => [row.id, row])
  )
  const candidateStaffNameByUserId = new Map(
    ((staffs ?? []) as Array<{ id: string; user_id: string | null; full_name: string }>)
      .filter((row) => Boolean(row.user_id))
      .map((row) => [row.user_id as string, row.full_name])
  )
  const appointmentById = new Map(
    ((appointments ?? []) as Array<{
      id: string
      customer_id: string | null
      pet_id: string | null
      staff_id: string | null
      start_time: string | null
      status: string | null
    }>).map((row) => [row.id, row])
  )
  const customerIdsWithFutureBookings = new Set(
    ((appointments ?? []) as Array<{
      id: string
      customer_id: string | null
      pet_id: string | null
      staff_id: string | null
      start_time: string | null
      status: string | null
    }>)
      .filter((row) => {
        if (!row.customer_id || !row.start_time) return false
        if (row.status === 'キャンセル' || row.status === '無断キャンセル') return false
        const startMs = new Date(row.start_time).getTime()
        return Number.isFinite(startMs) && startMs > nowMs
      })
      .map((row) => row.customer_id as string)
  )

  const blockedCustomerIds = new Set(
    ((activeTasks ?? []) as Array<{ customer_id: string | null; snoozed_until: string | null; status: string }>)
      .filter((row) => {
        if (!row.customer_id) return false
        if (!isResolvedStatus(row.status)) return true
        if (!row.snoozed_until) return false
        const snoozedUntilMs = new Date(row.snoozed_until).getTime()
        return Number.isFinite(snoozedUntilMs) && snoozedUntilMs > nowMs
      })
      .map((row) => row.customer_id as string)
  )

  const candidates = ((customers ?? []) as Array<{
    id: string
    full_name: string
    phone_number: string | null
    line_id: string | null
  }>)
    .map((customer) => {
      const lastVisit = lastVisitByCustomerId.get(customer.id)
      if (!lastVisit) return null
      if (customerIdsWithFutureBookings.has(customer.id)) return null
      if (blockedCustomerIds.has(customer.id)) return null

      const sourceAppointment = lastVisit.appointmentId
        ? appointmentById.get(lastVisit.appointmentId) ?? null
        : null
      const recommendedAt = addDays(lastVisit.visitDate, REVISIT_CYCLE_DAYS)
      if (!recommendedAt) return null
      if (recommendedAt.getTime() > nowMs) return null
      if (windowDays !== null && recommendedAt.getTime() < nowMs - windowDays * 24 * 60 * 60 * 1000) {
        return null
      }

      return {
        customer_id: customer.id,
        customer_name: customer.full_name,
        phone_number: customer.phone_number,
        line_id: customer.line_id,
        pet_id: sourceAppointment?.pet_id ?? null,
        source_appointment_id: sourceAppointment?.id ?? null,
        suggested_assigned_user_id:
          (sourceAppointment?.staff_id ? staffByStaffId.get(sourceAppointment.staff_id)?.user_id : null) ?? null,
        suggested_assigned_name:
          (sourceAppointment?.staff_id ? staffByStaffId.get(sourceAppointment.staff_id)?.full_name : null) ?? null,
        last_visit_at: lastVisit.visitDate,
        recommended_at: recommendedAt.toISOString(),
        overdue_days: Math.max(0, Math.floor((nowMs - recommendedAt.getTime()) / (24 * 60 * 60 * 1000))),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.overdue_days - a.overdue_days)

  return NextResponse.json({
    tasks: ((tasks ?? []) as FollowupTaskLike[]).map((task) => ({
      ...task,
      assignee_name:
        task.assigned_user_id && typeof task.assigned_user_id === 'string'
          ? candidateStaffNameByUserId.get(task.assigned_user_id) ?? null
          : null,
      events: eventsByTaskId.get(task.id) ?? [],
    })),
    candidates,
    assignees: ((staffs ?? []) as Array<{ user_id: string | null; full_name: string }>)
      .filter((row) => Boolean(row.user_id))
      .map((row) => ({ user_id: row.user_id as string, full_name: row.full_name })),
    templates: {
      followup_line: {
        body: followupTemplate,
      },
    },
  })
}

export async function POST(request: Request) {
  const allowed = await getFollowupRouteContext()
  if ('error' in allowed) return allowed.error

  const { supabase, storeId, user } = allowed
  const body = await request.json().catch(() => null)

  const customerId = toOptionalString(body?.customer_id)
  const petId = toOptionalString(body?.pet_id)
  const sourceAppointmentId = toOptionalString(body?.source_appointment_id)
  const lastVisitAt = toOptionalDate(body?.last_visit_at)
  const recommendedAt = toOptionalDate(body?.recommended_at)
  const assignedUserId = toOptionalString(body?.assigned_user_id) ?? user.id
  const priority = toOptionalString(body?.priority) ?? 'normal'
  const dueOn = toOptionalDateOnly(body?.due_on)
  const resolutionNote = toOptionalString(body?.resolution_note)

  if (!customerId || !lastVisitAt || !recommendedAt) {
    return jsonError('customer_id, last_visit_at, recommended_at は必須です。', 400)
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (customerError) return jsonError(customerError.message, 500)
  if (!customer) return jsonError('顧客が見つかりません。', 404)

  if (petId) {
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id')
      .eq('id', petId)
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .maybeSingle()
    if (petError) return jsonError(petError.message, 500)
    if (!pet) return jsonError('ペットが見つかりません。', 404)
  }

  const insertPayload: FollowupTaskInsert = {
    store_id: storeId,
    customer_id: customerId,
    pet_id: petId,
    source_appointment_id: sourceAppointmentId,
    last_visit_at: lastVisitAt,
    recommended_at: recommendedAt,
    status: 'open',
    priority,
    due_on: dueOn,
    assigned_user_id: assignedUserId,
    resolution_note: resolutionNote,
    updated_at: new Date().toISOString(),
  }

  const { data: task, error: insertError } = await supabase
    .from('customer_followup_tasks')
    .insert(insertPayload)
    .select('id, customer_id, pet_id, recommended_at, status, priority, assigned_user_id')
    .single()

  if (insertError) {
    return jsonError(insertError.message, insertError.code === '23505' ? 409 : 500)
  }

  const followupEvent: FollowupEventInsert = {
    store_id: storeId,
    task_id: task.id,
    actor_user_id: user.id,
    event_type: 'task_created',
    payload: toJson({
      assigned_user_id: assignedUserId,
      priority,
      due_on: dueOn,
    }),
  }

  const { error: eventError } = await supabase.from('customer_followup_events').insert(followupEvent)

  if (eventError) {
    return jsonError(eventError.message, 500)
  }

  return NextResponse.json({ task }, { status: 201 })
}
