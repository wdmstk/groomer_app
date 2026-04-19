import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createAppointment, normalizeCreateAppointmentInput } from '@/lib/appointments/services/create'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'
import { toOptionalString } from '@/lib/followups/shared'

const appointmentAuditSelect =
  'id, group_id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at'

function requestPrefersJson(request: Request) {
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('application/json')
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes, reservation_payment_method, reservation_payment_status, reservation_payment_paid_at, reservation_payment_authorized_at, customers(full_name), pets(name), staffs(full_name)'
    )
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const { supabase, storeId } = await createStoreScopedClient()
  const input = normalizeCreateAppointmentInput(formData)
  const followupTaskId = toOptionalString(formData.get('followup_task_id'))
  const reofferId = toOptionalString(formData.get('reoffer_id'))
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    const created = await createAppointment({
      supabase,
      storeId,
      input,
    })
    const { data: createdAppointment } = await supabase
      .from('appointments')
      .select(appointmentAuditSelect)
      .eq('id', created.id)
      .eq('store_id', storeId)
      .maybeSingle()

    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'appointment',
      entityId: created.id,
      action: 'created',
      after: createdAppointment ?? created,
      payload: {
        followup_task_id: followupTaskId,
        reoffer_id: reofferId,
      },
    })

    if (followupTaskId && user) {
      const nowIso = new Date().toISOString()
      const { error: taskError } = await supabase
        .from('customer_followup_tasks')
        .update({
          status: 'resolved_booked',
          resolved_at: nowIso,
          resolution_type: 'booked',
          resolution_note: '予約作成時に自動クローズ',
          updated_at: nowIso,
        })
        .eq('id', followupTaskId)
        .eq('store_id', storeId)

      if (!taskError) {
        await supabase.from('customer_followup_events').insert({
          store_id: storeId,
          task_id: followupTaskId,
          actor_user_id: user.id,
          event_type: 'appointment_created',
          payload: {
            appointment_id: created.id,
          },
        })
      }
    }

    if (reofferId && user) {
      const { data: reoffer } = await supabase
        .from('slot_reoffers')
        .select('appointment_id')
        .eq('id', reofferId)
        .eq('store_id', storeId)
        .maybeSingle()

      await supabase
        .from('slot_reoffers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reofferId)
        .eq('store_id', storeId)

      await supabase.from('slot_reoffer_logs').insert({
        store_id: storeId,
        slot_reoffer_id: reofferId,
        appointment_id: reoffer?.appointment_id ?? created.id,
        actor_user_id: user.id,
        event_type: 'appointment_created',
        payload: {
          created_appointment_id: created.id,
        },
      })
    }

    if (requestPrefersJson(request)) {
      return NextResponse.json({
        id: created.id,
        groupId: created.groupId,
        appointment: createdAppointment ?? created,
      })
    }

    return NextResponse.redirect(new URL('/reservation-management?tab=trimmer', request.url), { status: 303 })
  } catch (error) {
    if (error instanceof AppointmentServiceError) {
      const body =
        error.status === 409 ? { message: error.message, conflict: (error.details as { conflict?: unknown } | undefined)?.conflict ?? null } : { message: error.message }
      return NextResponse.json(body, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to create appointment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
