import { NextResponse } from 'next/server'
import {
  lookupPublicReservationQr,
} from '@/lib/public-reservations/services/qr-lookup'
import {
  normalizeQrLookupInput,
  PublicReservationServiceError,
} from '@/lib/public-reservations/services/shared'

type RouteParams = {
  params: Promise<{
    store_id: string
  }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { store_id: storeId } = await params

  try {
    const body = await request.json().catch(() => null)
    const input = normalizeQrLookupInput(body)
    const result = await lookupPublicReservationQr({
      storeId,
      qrPayloadText: input.qrPayloadText,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
