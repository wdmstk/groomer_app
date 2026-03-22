import { NextResponse } from 'next/server'
import {
  parseDiscountAmount,
  parseOptionalString,
  requireInvoiceStoreGuard,
  toUnknownObject,
} from '@/lib/invoices/shared'
import {
  calculateInvoiceTotalAfterDiscount,
  canEditInvoiceStatus,
  normalizeRequestedInvoiceStatus,
  summarizeInvoiceLines,
} from '@/lib/invoices/detail-core'

type RouteParams = {
  params: Promise<{
    invoice_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { invoice_id: invoiceId } = await params
    const { supabase, storeId } = await requireInvoiceStoreGuard()

    const [{ data: invoice, error: invoiceError }, { data: lines, error: linesError }] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, customer_id, status, currency, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, created_at, updated_at'
        )
        .eq('id', invoiceId)
        .eq('store_id', storeId)
        .maybeSingle(),
      supabase
        .from('invoice_lines')
        .select(
          'id, source_type, source_id, label, quantity, unit_amount, tax_rate, tax_included, line_subtotal, line_tax, line_total, sort_order, metadata, created_at'
        )
        .eq('invoice_id', invoiceId)
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    if (invoiceError) {
      return NextResponse.json({ message: invoiceError.message }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 })
    }

    if (linesError) {
      return NextResponse.json({ message: linesError.message }, { status: 500 })
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        lines: lines ?? [],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { invoice_id: invoiceId } = await params
    const { supabase, storeId, userId } = await requireInvoiceStoreGuard()
    const body: unknown = await request.json().catch(() => null)
    const payload = toUnknownObject(body)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const { data: existingInvoice, error: existingError } = await supabase
      .from('invoices')
      .select('id, status, subtotal_amount, tax_amount, discount_amount, total_amount, notes')
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ message: existingError.message }, { status: 500 })
    }

    if (!existingInvoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 })
    }

    if (!canEditInvoiceStatus(existingInvoice.status)) {
      return NextResponse.json({ message: 'INVOICE_NOT_EDITABLE: paid/void invoice cannot be edited.' }, { status: 409 })
    }

    const requestedStatusRaw = parseOptionalString(payload.status)
    const requestedStatus = normalizeRequestedInvoiceStatus(requestedStatusRaw)
    if (requestedStatusRaw && !requestedStatus) {
      return NextResponse.json({ message: 'Only draft/open status is allowed in this endpoint.' }, { status: 400 })
    }

    const discountAmount =
      payload.discount_amount === undefined
        ? Number(existingInvoice.discount_amount ?? 0)
        : parseDiscountAmount(payload.discount_amount)

    const notes = payload.notes === undefined ? (existingInvoice.notes as string | null) : parseOptionalString(payload.notes)

    const { data: lines, error: linesError } = await supabase
      .from('invoice_lines')
      .select('line_subtotal, line_tax, line_total')
      .eq('invoice_id', invoiceId)
      .eq('store_id', storeId)

    if (linesError) {
      return NextResponse.json({ message: linesError.message }, { status: 500 })
    }

    const summary = summarizeInvoiceLines(
      (lines ?? []) as Array<{ line_subtotal: number; line_tax: number; line_total: number }>
    )

    const totalAmount = calculateInvoiceTotalAfterDiscount(summary.total, discountAmount)

    const { data: updated, error: updateError } = await supabase
      .from('invoices')
      .update({
        status: requestedStatus ?? existingInvoice.status,
        subtotal_amount: Math.round(summary.subtotal),
        tax_amount: Math.round(summary.tax),
        discount_amount: discountAmount,
        total_amount: Math.round(totalAmount),
        notes,
        updated_by_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .select(
        'id, customer_id, status, currency, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, created_at, updated_at'
      )
      .single()

    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ invoice: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}
