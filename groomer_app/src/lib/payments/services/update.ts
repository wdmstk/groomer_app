import {
  calculatePaymentTotals,
  ensureAppointmentHasNoOtherPayment,
  fetchAppointmentMenus,
  handlePaymentCompletion,
  isDuplicatePaymentError,
  type PaymentSupabaseClient,
  type PaymentWriteInput,
  PaymentServiceError,
  resolveCustomerForPayment,
  validatePaymentWriteInput,
} from '@/lib/payments/services/shared'
import type { Database } from '@/lib/supabase/database.types'
import { isObjectRecord } from '@/lib/object-utils'

function toOptionalStringFromUnknown(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function toOptionalStringFromForm(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

function toNonNegativeNumberFromUnknown(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value)
    return Number.isFinite(normalized) ? Math.max(0, normalized) : 0
  }
  return 0
}

function toNonNegativeNumberFromForm(value: FormDataEntryValue | null) {
  if (value === null) return 0
  const normalized = Number(value)
  return Number.isFinite(normalized) ? Math.max(0, normalized) : 0
}

export function normalizeUpdatePaymentJsonInput(body: unknown): PaymentWriteInput {
  const normalized = isObjectRecord(body) ? body : null
  return {
    appointmentId: toOptionalStringFromUnknown(normalized?.appointment_id),
    customerId: toOptionalStringFromUnknown(normalized?.customer_id),
    method: toOptionalStringFromUnknown(normalized?.method) ?? '現金',
    discountAmount: toNonNegativeNumberFromUnknown(normalized?.discount_amount),
    notes: toOptionalStringFromUnknown(normalized?.notes),
  }
}

export function normalizeUpdatePaymentFormInput(formData: FormData): PaymentWriteInput {
  return {
    appointmentId: toOptionalStringFromForm(formData.get('appointment_id')),
    customerId: toOptionalStringFromForm(formData.get('customer_id')),
    method: toOptionalStringFromForm(formData.get('method')) ?? '現金',
    discountAmount: toNonNegativeNumberFromForm(formData.get('discount_amount')),
    notes: toOptionalStringFromForm(formData.get('notes')),
  }
}

export async function updatePayment(params: {
  supabase: PaymentSupabaseClient
  storeId: string
  paymentId: string
  input: PaymentWriteInput
  actorUserId?: string | null
}) {
  const { supabase, storeId, paymentId, input, actorUserId } = params
  validatePaymentWriteInput(input)
  await ensureAppointmentHasNoOtherPayment(supabase, storeId, input.appointmentId!, paymentId)

  const { resolvedCustomerId } = await resolveCustomerForPayment(
    supabase,
    storeId,
    input.appointmentId!,
    input.customerId
  )
  const menus = await fetchAppointmentMenus(supabase, storeId, input.appointmentId!)
  const totals = calculatePaymentTotals(menus)
  const totalAmount = Math.max(0, totals.total - input.discountAmount)

  const payload: Database['public']['Tables']['payments']['Update'] = {
    store_id: storeId,
    appointment_id: input.appointmentId!,
    customer_id: resolvedCustomerId,
    status: '支払済',
    method: input.method ?? '現金',
    subtotal_amount: Math.round(totals.subtotal),
    tax_amount: Math.round(totals.tax),
    discount_amount: input.discountAmount,
    total_amount: Math.round(totalAmount),
    paid_at: new Date().toISOString(),
    notes: input.notes,
  }

  const { data, error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId)
    .eq('store_id', storeId)
    .select(
      'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes'
    )
    .single()

  if (error) {
    if (isDuplicatePaymentError(error)) {
      throw new PaymentServiceError('この予約にはすでに会計が登録されています。二重会計はできません。', 409)
    }
    throw new PaymentServiceError(error.message, 500)
  }

  if (!data.visit_id) {
    await handlePaymentCompletion(
      supabase,
      storeId,
      input.appointmentId!,
      paymentId,
      Math.round(totalAmount),
      actorUserId
    )
  }

  return data
}
