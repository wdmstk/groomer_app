import { verifySignedPetQrPayload } from '@/lib/qr/pet-profile-signature'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { PublicReservationServiceError } from '@/lib/public-reservations/services/shared'

export async function lookupPublicReservationQr(params: {
  storeId: string
  qrPayloadText: string
}) {
  if (!params.qrPayloadText) {
    throw new PublicReservationServiceError('qrPayload は必須です。')
  }

  const verified = verifySignedPetQrPayload(params.qrPayloadText)
  if (!verified.ok) {
    throw new PublicReservationServiceError(`QR署名を検証できませんでした。(${verified.reason})`)
  }

  const payload = verified.payload
  const admin = createAdminSupabaseClient()
  const { data: pet, error } = await admin
    .from('pets')
    .select('id, name, breed, customer_id, customers!inner(id, full_name, phone_number)')
    .eq('id', payload.pet_id)
    .eq('customer_id', payload.customer_id)
    .eq('store_id', params.storeId)
    .single()

  if (error || !pet) {
    throw new PublicReservationServiceError('この店舗に一致する顧客・ペットが見つかりません。', 404)
  }

  const customer = Array.isArray(pet.customers) ? pet.customers[0] : pet.customers
  if (!customer?.id) {
    throw new PublicReservationServiceError('顧客情報を解決できません。', 404)
  }

  return {
    verified: true,
    customer: {
      id: customer.id,
      full_name: customer.full_name ?? payload.customer_name,
      phone_number: customer.phone_number ?? payload.phone_number ?? '',
    },
    pet: {
      id: pet.id,
      name: pet.name ?? payload.pet_name,
      breed: pet.breed ?? payload.pet_breed ?? '',
    },
  }
}
