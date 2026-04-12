import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import {
  createPublicReservation,
  fetchPublicReservationBootstrap,
} from '@/lib/public-reservations/services/create'
import {
  normalizePublicReservationInput,
  PublicReservationServiceError,
} from '@/lib/public-reservations/services/shared'

type RouteParams = {
  params: Promise<{
    store_id: string
  }>
}

function toJson(value: unknown): Json {
  return (value ?? null) as Json
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { store_id: storeId } = await params

  try {
    const data = await fetchPublicReservationBootstrap({ storeId })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { store_id: storeId } = await params
  const adminSupabase = createAdminSupabaseClient()
  const requestUrl = new URL(request.url)
  const body = await request.json().catch(() => null)
  const input = normalizePublicReservationInput(body)

  try {
    const data = await createPublicReservation({
      storeId,
      input,
      requestOrigin: requestUrl.origin,
    })

    if (input.memberPortalToken && data.appointmentId) {
      await adminSupabase.from('audit_logs').insert({
        store_id: storeId,
        actor_user_id: null,
        entity_type: 'appointment',
        entity_id: data.appointmentId,
        action: 'created',
        before: null,
        after: toJson({
          id: data.appointmentId,
          group_id: data.groupId ?? null,
          status: data.status,
        }),
        payload: toJson({
          source: 'member_portal',
          member_portal_token_present: true,
          appointment_group_id: data.groupId ?? null,
        }),
      })
    }

    if (data.appointmentId) {
      await adminSupabase.from('audit_logs').insert({
        store_id: storeId,
        actor_user_id: null,
        entity_type: 'appointment',
        entity_id: data.appointmentId,
        action: 'public_reservation_submitted',
        before: null,
        after: toJson({
          id: data.appointmentId,
          group_id: data.groupId ?? null,
          status: data.status,
        }),
        payload: toJson({
          flow: data.status === '予約済' ? 'instant_confirmed' : 'request_pending',
          appointment_group_id: data.groupId ?? null,
          staff_id: data.assignedStaffId ?? null,
          selected_menu_count: input.menuIds.length,
          has_member_portal_token: Boolean(input.memberPortalToken),
        }),
      })
    }

    return NextResponse.json({
      ...data,
      payment_token: data.paymentToken,
    })
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      if (error.status === 409) {
        await adminSupabase.from('audit_logs').insert({
          store_id: storeId,
          actor_user_id: null,
          entity_type: 'store',
          entity_id: storeId,
          action: 'public_reservation_conflict_rejected',
          before: null,
          after: null,
          payload: toJson({
            selected_menu_count: input.menuIds.length,
            preferred_start: input.preferredStart,
            has_member_portal_token: Boolean(input.memberPortalToken),
            reason: error.message,
          }),
        })
      }
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
