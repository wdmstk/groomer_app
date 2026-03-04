import { buildSignedPetQrPayload, type SignedPetQrPayload } from '@/lib/qr/pet-profile-signature'

export type PetQrPayload = SignedPetQrPayload

export function buildPetQrProfile(params: {
  customerId: string
  customerName: string
  phoneNumber?: string | null
  petId: string
  petName: string
  petBreed?: string | null
}) {
  const payload: PetQrPayload = buildSignedPetQrPayload({
    customerId: params.customerId,
    customerName: params.customerName,
    phoneNumber: params.phoneNumber ?? '',
    petId: params.petId,
    petName: params.petName,
    petBreed: params.petBreed ?? '',
  })
  const payloadText = JSON.stringify(payload)
  const qrImageUrl = `/api/qr/pet-profile?customer_name=${encodeURIComponent(
    params.customerName
  )}&pet_name=${encodeURIComponent(params.petName)}&payload=${encodeURIComponent(payloadText)}&v=2`

  return {
    qrImageUrl,
    qrPayload: payloadText,
  }
}
