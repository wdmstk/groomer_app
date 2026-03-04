import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
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

  try {
    const adminSupabase = createAdminSupabaseClient()
    const requestUrl = new URL(request.url)
    const body = await request.json().catch(() => null)
    const input = normalizePublicReservationInput(body)
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
        after: {
          id: data.appointmentId,
          status: data.status,
        },
        payload: {
          source: 'member_portal',
          member_portal_token_present: true,
        },
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
