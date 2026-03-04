import { NextResponse } from 'next/server'
import { cancelPublicReservation } from '@/lib/public-reservations/services/cancel'
import { PublicReservationServiceError } from '@/lib/public-reservations/services/shared'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const result = await cancelPublicReservation({ token })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
