import { NextResponse } from 'next/server'
import { buildPetQrProfile } from '@/lib/qr/pet-profile'
import {
  getMemberPortalReservationPrefill,
  MemberPortalServiceError,
} from '@/lib/member-portal'

type RouteParams = {
  params: Promise<{
    token: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const prefill = await getMemberPortalReservationPrefill(token)
    const qr =
      prefill.pet &&
      buildPetQrProfile({
        customerId: prefill.customer.id,
        customerName: prefill.customer.full_name,
        phoneNumber: prefill.customer.phone_number,
        petId: prefill.pet.id,
        petName: prefill.pet.name,
        petBreed: prefill.pet.breed,
      })

    return NextResponse.json({
      store: prefill.store,
      customer: prefill.customer,
      pet: prefill.pet,
      pets: prefill.pets.map((pet) => ({
        ...pet,
        qrPayload: buildPetQrProfile({
          customerId: prefill.customer.id,
          customerName: prefill.customer.full_name,
          phoneNumber: prefill.customer.phone_number,
          petId: pet.id,
          petName: pet.name,
          petBreed: pet.breed,
        }).qrPayload,
      })),
      qrPayload: qr?.qrPayload ?? '',
    })
  } catch (error) {
    if (error instanceof MemberPortalServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
