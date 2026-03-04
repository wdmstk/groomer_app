import type { PaymentSupabaseClient } from '@/lib/payments/services/shared'
import { PaymentServiceError } from '@/lib/payments/services/shared'

export async function deletePayment(params: {
  supabase: PaymentSupabaseClient
  storeId: string
  paymentId: string
}) {
  const { supabase, storeId, paymentId } = params
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)
    .eq('store_id', storeId)

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  return { success: true as const }
}
