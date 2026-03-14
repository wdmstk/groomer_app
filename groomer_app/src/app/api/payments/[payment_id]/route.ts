import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { deletePayment } from '@/lib/payments/services/delete'
import { PaymentServiceError } from '@/lib/payments/services/shared'
import {
  normalizeUpdatePaymentFormInput,
  normalizeUpdatePaymentJsonInput,
  updatePayment,
} from '@/lib/payments/services/update'

type RouteParams = {
  params: Promise<{
    payment_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { payment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes'
    )
    .eq('id', payment_id)
    .eq('store_id', storeId)
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { payment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('payments')
    .select('id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes')
    .eq('id', payment_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const body: unknown = await request.json().catch(() => null)
  const input = normalizeUpdatePaymentJsonInput(body)

  try {
    const data = await updatePayment({
      supabase,
      storeId,
      paymentId: payment_id,
      input,
      actorUserId: user?.id ?? null,
    })
    await insertAuditLogBestEffort({
      supabase,
      storeId,
      actorUserId: user?.id ?? null,
      entityType: 'payment',
      entityId: payment_id,
      action: 'updated',
      before,
      after: data,
    })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to update payment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { payment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: before } = await supabase
    .from('payments')
    .select('id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes')
    .eq('id', payment_id)
    .eq('store_id', storeId)
    .maybeSingle()
  try {
    const result = await deletePayment({
      supabase,
      storeId,
      paymentId: payment_id,
    })
    if (before) {
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'payment',
        entityId: payment_id,
        action: 'deleted',
        before,
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Failed to delete payment.'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteParams) {
  const formData = await request.formData()
  const method = formData.get('_method')?.toString().toLowerCase()
  const { payment_id } = await context.params

  if (method === 'delete') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('payments')
      .select('id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes')
      .eq('id', payment_id)
      .eq('store_id', storeId)
      .maybeSingle()
    try {
      await deletePayment({
        supabase,
        storeId,
        paymentId: payment_id,
      })
      if (before) {
        await insertAuditLogBestEffort({
          supabase,
          storeId,
          actorUserId: user?.id ?? null,
          entityType: 'payment',
          entityId: payment_id,
          action: 'deleted',
          before,
        })
      }
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return NextResponse.json({ message: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to delete payment.'
      return NextResponse.json({ message }, { status: 500 })
    }
    return NextResponse.redirect(new URL('/payments?tab=list', request.url))
  }

  if (method === 'put' || method === 'patch') {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: before } = await supabase
      .from('payments')
      .select('id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes')
      .eq('id', payment_id)
      .eq('store_id', storeId)
      .maybeSingle()
    const input = normalizeUpdatePaymentFormInput(formData)

    try {
      const updated = await updatePayment({
        supabase,
        storeId,
        paymentId: payment_id,
        input,
        actorUserId: user?.id ?? null,
      })
      await insertAuditLogBestEffort({
        supabase,
        storeId,
        actorUserId: user?.id ?? null,
        entityType: 'payment',
        entityId: payment_id,
        action: 'updated',
        before,
        after: updated,
      })
      return NextResponse.redirect(new URL(`/receipts/${payment_id}`, request.url))
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return NextResponse.json({ message: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Failed to update payment.'
      return NextResponse.json({ message }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Unsupported method' }, { status: 405 })
}
