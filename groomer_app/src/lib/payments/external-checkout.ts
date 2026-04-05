import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { BillingProvider } from '@/lib/billing/types'
import {
  calculatePaymentTotals,
  fetchAppointmentMenus,
  findPaymentByAppointment,
  handlePaymentCompletion,
  PAYMENT_SELECT_COLUMNS,
} from '@/lib/payments/services/shared'
import type { Database } from '@/lib/supabase/database.types'

function parseNonNegativeInt(value: string | undefined) {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

function paymentMethodByProvider(provider: BillingProvider) {
  return provider === 'komoju' ? 'KOMOJU' : 'Stripe'
}

export async function settleAppointmentPaymentFromProvider(params: {
  storeId: string
  appointmentId: string
  provider: BillingProvider
  idempotencyKey: string
  metadata?: Record<string, string | undefined>
}) {
  const admin = createAdminSupabaseClient()
  const supabase = admin

  const existing = await findPaymentByAppointment(supabase as never, params.storeId, params.appointmentId)
  if (existing) {
    return existing
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, customer_id')
    .eq('store_id', params.storeId)
    .eq('id', params.appointmentId)
    .maybeSingle()
  if (appointmentError) throw new Error(appointmentError.message)
  if (!appointment || !appointment.customer_id) {
    throw new Error('appointment/customer not found for external payment.')
  }

  const menus = await fetchAppointmentMenus(supabase as never, params.storeId, params.appointmentId)
  const totals = calculatePaymentTotals(menus)
  const discountAmount = parseNonNegativeInt(params.metadata?.discount_amount_jpy)
  const totalAmount = Math.max(0, Math.round(totals.total) - discountAmount)

  const payload: Database['public']['Tables']['payments']['Insert'] = {
    store_id: params.storeId,
    appointment_id: params.appointmentId,
    customer_id: appointment.customer_id,
    status: '支払済',
    method: paymentMethodByProvider(params.provider),
    subtotal_amount: Math.round(totals.subtotal),
    tax_amount: Math.round(totals.tax),
    discount_amount: discountAmount,
    total_amount: totalAmount,
    idempotency_key: params.idempotencyKey,
    paid_at: new Date().toISOString(),
    notes: '外部決済（Checkout完了）',
  }

  const { data: inserted, error: insertError } = await supabase
    .from('payments')
    .insert(payload)
    .select(PAYMENT_SELECT_COLUMNS)
    .maybeSingle()
  if (insertError) {
    const duplicated = insertError.code === '23505' || insertError.message?.includes('duplicate key')
    if (!duplicated) throw new Error(insertError.message)
  }

  const payment = inserted ?? (await findPaymentByAppointment(supabase as never, params.storeId, params.appointmentId))
  if (!payment) {
    throw new Error('failed to resolve payment row after provider settlement.')
  }

  await handlePaymentCompletion(
    supabase as never,
    params.storeId,
    params.appointmentId,
    payment.id,
    payment.total_amount,
    null
  )

  const { data: settled, error: settledError } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT_COLUMNS)
    .eq('store_id', params.storeId)
    .eq('id', payment.id)
    .single()
  if (settledError) throw new Error(settledError.message)
  return settled
}
