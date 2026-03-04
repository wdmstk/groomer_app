import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { deleteAppointment } from '@/lib/appointments/services/delete'
import { AppointmentServiceError } from '@/lib/appointments/services/shared'
import {
  normalizeUpdateAppointmentFormInput,
  normalizeUpdateAppointmentJsonInput,
  updateAppointment,
} from '@/lib/appointments/services/update'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

const appointmentAuditSelect =
  'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes'


export async function GET(_request: Request, { params }: RouteParams) {
  const { appointment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, customer_id, pet_id, staff_id, start_time, end_time, menu, duration, status, notes'
    )
    .eq('id', appointment_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { appointment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('appointments')
    .select(appointmentAuditSelect)
    .eq('id', appointment_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const input = normalizeUpdateAppointmentJsonInput(body)

  try {
    const data = await updateAppointment({
      supabase,
      storeId,
      appointmentId: appointment_id,
      input,
    })
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'appointment',
      entityId: appointment_id,
      action: 'updated',
      before,
      after: data,
    })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof AppointmentServiceError) {
      const body =
        error.status === 409 ? { message: error.message, conflict: (error.details as { conflict?: unknown } | undefined)?.conflict ?? null } : { message: error.message }
      return NextResponse.json(body, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to update appointment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { appointment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('appointments')
    .select(appointmentAuditSelect)
    .eq('id', appointment_id)
    .eq('store_id', storeId)
    .maybeSingle()
  try {
    const result = await deleteAppointment({
      supabase,
      storeId,
      appointmentId: appointment_id,
    })
    if (before) {
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'appointment',
        entityId: appointment_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AppointmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to delete appointment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { appointment_id } = await context.params

  if (method === 'delete') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('appointments')
      .select(appointmentAuditSelect)
      .eq('id', appointment_id)
      .eq('store_id', storeId)
      .maybeSingle()
    try {
      await deleteAppointment({
        supabase,
        storeId,
        appointmentId: appointment_id,
      })
      if (before) {
        await insertAuditLogBestEffort({
          supabase,
          storeId,
          actorUserId: user?.id ?? null,
          entityType: 'appointment',
          entityId: appointment_id,
          action: 'deleted',
          before,
        })
      }
    } catch (error) {
      if (error instanceof AppointmentServiceError) {
        return NextResponse.json({ message: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to delete appointment.'
      return NextResponse.json({ message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/appointments?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('appointments')
      .select(appointmentAuditSelect)
      .eq('id', appointment_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const input = normalizeUpdateAppointmentFormInput(formData)

    try {
      const updated = await updateAppointment({
        supabase,
        storeId,
        appointmentId: appointment_id,
        input,
      })
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'appointment',
        entityId: appointment_id,
        action: 'updated',
        before,
        after: updated,
      })
      return NextResponse.redirect(new URL('/appointments', request.url))
    } catch (error) {
      if (error instanceof AppointmentServiceError) {
        const body =
          error.status === 409 ? { message: error.message, conflict: (error.details as { conflict?: unknown } | undefined)?.conflict ?? null } : { message: error.message }
        return NextResponse.json(body, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to update appointment.'
      return NextResponse.json({ message }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
