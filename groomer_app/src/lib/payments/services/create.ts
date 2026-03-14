import {
  calculatePaymentTotals,
  findPaymentByAppointment,
  findPaymentByIdempotencyKey,
  fetchAppointmentMenus,
  handlePaymentCompletion,
  isDuplicatePaymentError,
  PAYMENT_SELECT_COLUMNS,
  type PaymentSupabaseClient,
  type PaymentWriteInput,
  PaymentServiceError,
  resolveCustomerForPayment,
  validatePaymentWriteInput,
} from '@/lib/payments/services/shared'
import type { Database } from '@/lib/supabase/database.types'

function toOptionalString(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? ''
  return normalized || null
}

function toNonNegativeNumber(value: FormDataEntryValue | null) {
  if (value === null) return 0
  const normalized = Number(value)
  return Number.isFinite(normalized) ? Math.max(0, normalized) : 0
}

export function normalizeCreatePaymentInput(formData: FormData): PaymentWriteInput {
  return {
    appointmentId: toOptionalString(formData.get('appointment_id')),
    customerId: toOptionalString(formData.get('customer_id')),
    method: toOptionalString(formData.get('method')) ?? '現金',
    discountAmount: toNonNegativeNumber(formData.get('discount_amount')),
    notes: toOptionalString(formData.get('notes')),
    idempotencyKey: toOptionalString(formData.get('idempotency_key')),
  }
}

async function ensurePaymentCompletionIfNeeded(params: {
  supabase: PaymentSupabaseClient
  storeId: string
  actorUserId?: string | null
  payment: { id: string; appointment_id: string; visit_id?: string | null; total_amount: number }
}) {
  const { supabase, storeId, actorUserId, payment } = params
  if (!payment.visit_id) {
    await handlePaymentCompletion(
      supabase,
      storeId,
      payment.appointment_id,
      payment.id,
      payment.total_amount,
      actorUserId
    )
  }

  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT_COLUMNS)
    .eq('id', payment.id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    throw new PaymentServiceError(error.message, 500)
  }

  return data
}

export async function createPayment(params: {
  supabase: PaymentSupabaseClient
  storeId: string
  input: PaymentWriteInput
  actorUserId?: string | null
}) {
  const { supabase, storeId, input, actorUserId } = params
  validatePaymentWriteInput(input)

  if (input.idempotencyKey) {
    const existingByKey = await findPaymentByIdempotencyKey(supabase, storeId, input.idempotencyKey)
    if (existingByKey) {
      if (existingByKey.appointment_id !== input.appointmentId) {
        throw new PaymentServiceError('この会計リクエストは別の予約ですでに使用されています。', 409)
      }
      return ensurePaymentCompletionIfNeeded({
        supabase,
        storeId,
        actorUserId,
        payment: existingByKey,
      })
    }
  }

  const existingByAppointment = await findPaymentByAppointment(supabase, storeId, input.appointmentId!)
  if (existingByAppointment) {
    if (
      input.idempotencyKey &&
      existingByAppointment.idempotency_key &&
      existingByAppointment.idempotency_key === input.idempotencyKey
    ) {
      return ensurePaymentCompletionIfNeeded({
        supabase,
        storeId,
        actorUserId,
        payment: existingByAppointment,
      })
    }
    throw new PaymentServiceError('この予約にはすでに会計が登録されています。二重会計はできません。', 409)
  }

  const { resolvedCustomerId } = await resolveCustomerForPayment(
    supabase,
    storeId,
    input.appointmentId!,
    input.customerId
  )
  const menus = await fetchAppointmentMenus(supabase, storeId, input.appointmentId!)
  const totals = calculatePaymentTotals(menus)
  const totalAmount = Math.max(0, totals.total - input.discountAmount)

  const payload: Database['public']['Tables']['payments']['Insert'] = {
    store_id: storeId,
    appointment_id: input.appointmentId!,
    customer_id: resolvedCustomerId,
    status: '支払済',
    method: input.method ?? '現金',
    subtotal_amount: Math.round(totals.subtotal),
    tax_amount: Math.round(totals.tax),
    discount_amount: input.discountAmount,
    total_amount: Math.round(totalAmount),
    idempotency_key: input.idempotencyKey,
    paid_at: new Date().toISOString(),
    notes: input.notes,
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert(payload)
    .select(PAYMENT_SELECT_COLUMNS)
    .single()

  if (error) {
    if (isDuplicatePaymentError(error)) {
      if (input.idempotencyKey) {
        const existingByKey = await findPaymentByIdempotencyKey(supabase, storeId, input.idempotencyKey)
        if (existingByKey && existingByKey.appointment_id === input.appointmentId) {
          return ensurePaymentCompletionIfNeeded({
            supabase,
            storeId,
            actorUserId,
            payment: existingByKey,
          })
        }
      }
      throw new PaymentServiceError('この予約にはすでに会計が登録されています。二重会計はできません。', 409)
    }
    throw new PaymentServiceError(error.message, 500)
  }

  return ensurePaymentCompletionIfNeeded({
    supabase,
    storeId,
    actorUserId,
    payment,
  })
}
