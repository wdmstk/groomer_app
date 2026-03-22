import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { parseOptionalString, requireInvoiceStoreGuard } from '@/lib/invoices/shared'
import {
  canInvoiceBePaid,
  collectStayIdsFromInvoiceLines,
  isInvoiceCustomerMismatch,
  resolveAppointmentIdFromInvoiceLines,
} from '@/lib/invoices/pay-core'

type RouteParams = {
  params: Promise<{
    invoice_id: string
  }>
}

const PAYMENT_METHOD_FALLBACK = '現金'

function parseBodyToObject(value: unknown) {
  if (value instanceof FormData) {
    return {
      method: parseOptionalString(value.get('method')),
      notes: parseOptionalString(value.get('notes')),
      idempotency_key: parseOptionalString(value.get('idempotency_key')),
    }
  }

  return asObjectOrNull(value)
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { invoice_id: invoiceId } = await params
    const { supabase, storeId, userId } = await requireInvoiceStoreGuard()

    const contentType = request.headers.get('content-type') ?? ''
    const rawBody: unknown = contentType.includes('application/json')
      ? await request.json().catch(() => null)
      : await request.formData().catch(() => null)

    const body = parseBodyToObject(rawBody)
    const method = parseOptionalString(body?.method) ?? PAYMENT_METHOD_FALLBACK
    const notes = parseOptionalString(body?.notes)
    const idempotencyKey = parseOptionalString(body?.idempotency_key)

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, customer_id, status, subtotal_amount, tax_amount, discount_amount, total_amount, notes')
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (invoiceError) {
      return NextResponse.json({ message: invoiceError.message }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 })
    }

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('id, invoice_id, paid_at')
      .eq('store_id', storeId)
      .eq('invoice_id', invoiceId)
      .maybeSingle()

    if (existingPaymentError) {
      return NextResponse.json({ message: existingPaymentError.message }, { status: 500 })
    }

    const payable = canInvoiceBePaid({
      status: invoice.status,
      existingPaymentId: existingPayment?.id,
    })

    if (payable.ok && payable.reused) {
      if (!existingPayment?.id) {
        return NextResponse.json({ message: 'Invoice is already paid.' }, { status: 409 })
      }
      return NextResponse.json({ ok: true, payment_id: existingPayment.id, reused: true })
    }

    if (!payable.ok && payable.code === 'ALREADY_PAID') {
      return NextResponse.json({ message: 'Invoice is already paid.' }, { status: 409 })
    }

    if (!payable.ok && payable.code === 'VOID_NOT_PAYABLE') {
      return NextResponse.json({ message: 'INVOICE_NOT_EDITABLE: void invoice cannot be paid.' }, { status: 409 })
    }

    const { data: lines, error: linesError } = await supabase
      .from('invoice_lines')
      .select('source_type, metadata')
      .eq('store_id', storeId)
      .eq('invoice_id', invoiceId)

    if (linesError) {
      return NextResponse.json({ message: linesError.message }, { status: 500 })
    }

    const invoiceLines = (lines ?? []) as Array<{ source_type: string; metadata: unknown }>

    let appointmentId = resolveAppointmentIdFromInvoiceLines({ lines: invoiceLines })

    if (!appointmentId) {
      const stayIds = collectStayIdsFromInvoiceLines(invoiceLines)

      if (stayIds.length > 0) {
        const { data: stays, error: stayError } = await supabase
          .from('hotel_stays')
          .select('id, appointment_id')
          .eq('store_id', storeId)
          .in('id', stayIds)

        if (stayError) {
          return NextResponse.json({ message: stayError.message }, { status: 500 })
        }

        appointmentId = resolveAppointmentIdFromInvoiceLines({
          lines: invoiceLines,
          hotelStays: (stays ?? []) as Array<{ appointment_id: string | null }>,
        })
      }
    }

    if (!appointmentId) {
      return NextResponse.json(
        {
          message:
            'この請求は会計確定に必要な予約IDを解決できません。ホテル予約に appointment_id を紐づけてから再実行してください。',
        },
        { status: 409 }
      )
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, customer_id')
      .eq('id', appointmentId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (appointmentError) {
      return NextResponse.json({ message: appointmentError.message }, { status: 500 })
    }

    if (
      !appointment ||
      isInvoiceCustomerMismatch({
        invoiceCustomerId: invoice.customer_id as string,
        appointmentCustomerId: appointment.customer_id,
      })
    ) {
      return NextResponse.json({ message: 'INVOICE_SCOPE_MISMATCH: appointment and invoice customer mismatch.' }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const paymentPayload = {
      store_id: storeId,
      appointment_id: appointmentId,
      customer_id: invoice.customer_id,
      status: '支払済',
      method,
      subtotal_amount: Math.round(Number(invoice.subtotal_amount ?? 0)),
      tax_amount: Math.round(Number(invoice.tax_amount ?? 0)),
      discount_amount: Math.round(Number(invoice.discount_amount ?? 0)),
      total_amount: Math.round(Number(invoice.total_amount ?? 0)),
      paid_at: nowIso,
      notes: notes ?? invoice.notes,
      invoice_id: invoiceId,
      idempotency_key: idempotencyKey,
    }

    const { data: insertedPayment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentPayload as never)
      .select('id')
      .single()

    if (paymentError || !insertedPayment) {
      return NextResponse.json({ message: paymentError?.message ?? 'Failed to create payment.' }, { status: 500 })
    }

    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: nowIso,
        closed_at: nowIso,
        updated_by_user_id: userId,
        updated_at: nowIso,
      })
      .eq('id', invoiceId)
      .eq('store_id', storeId)

    if (invoiceUpdateError) {
      return NextResponse.json({ message: invoiceUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, payment_id: insertedPayment.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}
