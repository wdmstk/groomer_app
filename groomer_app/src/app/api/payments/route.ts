import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createPayment, normalizeCreatePaymentInput } from '@/lib/payments/services/create'
import { PaymentServiceError } from '@/lib/payments/services/shared'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET() {
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, customers(full_name), appointments(id)'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const input = normalizeCreatePaymentInput(formData)
  const headerIdempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? ''

  if (!input.idempotencyKey && headerIdempotencyKey) {
    input.idempotencyKey = headerIdempotencyKey
  }

  try {
    const payment = await createPayment({
      supabase,
      storeId,
      input,
      actorUserId: user?.id ?? null,
    })
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'payment',
      entityId: payment.id,
      action: 'created',
      after: payment,
      payload: {
        appointment_id: payment.appointment_id,
        idempotency_key: input.idempotencyKey ?? null,
      },
    })
    return NextResponse.redirect(new URL(redirectTo ?? `/receipts/${payment.id}`, request.url))
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to create payment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
