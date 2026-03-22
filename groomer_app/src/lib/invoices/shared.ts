import { createStoreScopedClient } from '@/lib/supabase/store'
export {
  calculateTaxLine,
  parseDiscountAmount,
  parseOptionalString,
  parseStringArray,
  toUnknownObject,
} from '@/lib/invoices/utils'

type InvoiceSupabaseClient = Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']

export type InvoiceStoreGuard = {
  supabase: InvoiceSupabaseClient
  storeId: string
  userId: string
}

export async function requireInvoiceStoreGuard(): Promise<InvoiceStoreGuard> {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error('Forbidden')
  }

  return {
    supabase,
    storeId,
    userId: user.id,
  }
}
