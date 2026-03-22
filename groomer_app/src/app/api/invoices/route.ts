import { NextResponse } from 'next/server'
import {
  parseOptionalString,
  parseStringArray,
  toUnknownObject,
  requireInvoiceStoreGuard,
} from '@/lib/invoices/shared'
import type { UnknownObject } from '@/lib/object-utils'
import {
  buildAppointmentMenuLineDraft,
  buildHotelStayItemLineDraft,
  hasCustomerMismatch,
  sumInvoice,
  validateInvoiceCreateInput,
  type InvoiceLineDraft,
} from '@/lib/invoices/create-core'

export async function GET() {
  try {
    const { supabase, storeId } = await requireInvoiceStoreGuard()
    const { data, error } = await supabase
      .from('invoices')
      .select('id, customer_id, status, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({ invoices: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, storeId, userId } = await requireInvoiceStoreGuard()
    const body: unknown = await request.json().catch(() => null)
    const payload = toUnknownObject(body)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }
    const customerId = parseOptionalString(payload.customer_id)
    const notes = parseOptionalString(payload.notes)
    const appointmentIds = Array.from(new Set(parseStringArray(payload.appointment_ids)))
    const hotelStayIds = Array.from(new Set(parseStringArray(payload.hotel_stay_ids)))

    const inputValidationMessage = validateInvoiceCreateInput({
      customerId,
      appointmentIds,
      hotelStayIds,
    })
    if (inputValidationMessage) {
      return NextResponse.json({ message: inputValidationMessage }, { status: 400 })
    }

    const lineDrafts: InvoiceLineDraft[] = []

    if (appointmentIds.length > 0) {
      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, customer_id')
        .eq('store_id', storeId)
        .in('id', appointmentIds)

      if (appointmentError) {
        return NextResponse.json({ message: appointmentError.message }, { status: 500 })
      }

      const appointmentRows = (appointments ?? []) as Array<{ id: string; customer_id: string | null }>
      if (appointmentRows.length !== appointmentIds.length) {
        return NextResponse.json({ message: 'One or more appointments are not found.' }, { status: 400 })
      }

      if (hasCustomerMismatch(appointmentRows.map((row) => row.customer_id), customerId)) {
        return NextResponse.json({ message: 'INVOICE_SCOPE_MISMATCH: appointment customer mismatch.' }, { status: 400 })
      }

      const { data: appointmentMenus, error: menuError } = await supabase
        .from('appointment_menus')
        .select('id, appointment_id, menu_id, menu_name, price, tax_rate, tax_included')
        .eq('store_id', storeId)
        .in('appointment_id', appointmentIds)

      if (menuError) {
        return NextResponse.json({ message: menuError.message }, { status: 500 })
      }

      const menuRows = (appointmentMenus ?? []) as Array<{
        id: string
        appointment_id: string
        menu_id: string | null
        menu_name: string | null
        price: number | null
        tax_rate: number | null
        tax_included: boolean | null
      }>

      lineDrafts.push(...menuRows.map((row) => buildAppointmentMenuLineDraft(row)))
    }

    if (hotelStayIds.length > 0) {
      const { data: stays, error: stayError } = await supabase
        .from('hotel_stays')
        .select('id, customer_id, pet_id')
        .eq('store_id', storeId)
        .in('id', hotelStayIds)

      if (stayError) {
        return NextResponse.json({ message: stayError.message }, { status: 500 })
      }

      const stayRows = (stays ?? []) as Array<{ id: string; customer_id: string | null; pet_id: string }>
      if (stayRows.length !== hotelStayIds.length) {
        return NextResponse.json({ message: 'One or more hotel stays are not found.' }, { status: 400 })
      }

      const petIds = Array.from(new Set(stayRows.map((row) => row.pet_id).filter(Boolean)))
      const { data: pets, error: petError } = await supabase
        .from('pets')
        .select('id, customer_id')
        .eq('store_id', storeId)
        .in('id', petIds)

      if (petError) {
        return NextResponse.json({ message: petError.message }, { status: 500 })
      }

      const petCustomerById = new Map<string, string>()
      ;((pets ?? []) as Array<{ id: string; customer_id: string | null }>).forEach((pet) => {
        if (pet.customer_id) {
          petCustomerById.set(pet.id, pet.customer_id)
        }
      })

      const mismatchedStay = hasCustomerMismatch(
        stayRows.map((stay) => stay.customer_id ?? petCustomerById.get(stay.pet_id) ?? null),
        customerId
      )

      if (mismatchedStay) {
        return NextResponse.json({ message: 'INVOICE_SCOPE_MISMATCH: hotel stay customer mismatch.' }, { status: 400 })
      }

      const { data: stayItems, error: stayItemError } = await supabase
        .from('hotel_stay_items')
        .select(
          'id, stay_id, label_snapshot, quantity, unit_price_snapshot, line_amount_jpy, tax_rate_snapshot, tax_included_snapshot'
        )
        .eq('store_id', storeId)
        .in('stay_id', hotelStayIds)

      if (stayItemError) {
        return NextResponse.json({ message: stayItemError.message }, { status: 500 })
      }

      lineDrafts.push(...((stayItems ?? []) as UnknownObject[]).map((row) => buildHotelStayItemLineDraft(row)))
    }

    if (lineDrafts.length === 0) {
      return NextResponse.json({ message: 'No invoice lines generated.' }, { status: 400 })
    }

    const totals = sumInvoice(lineDrafts)

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        store_id: storeId,
        customer_id: customerId,
        status: 'open',
        currency: 'JPY',
        subtotal_amount: totals.subtotal,
        tax_amount: totals.tax,
        discount_amount: 0,
        total_amount: totals.total,
        notes,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      })
      .select('id, customer_id, status, subtotal_amount, tax_amount, discount_amount, total_amount, notes, created_at')
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ message: invoiceError?.message ?? 'Failed to create invoice.' }, { status: 500 })
    }

    const insertLines = lineDrafts.map((line, index) => ({
      store_id: storeId,
      invoice_id: invoice.id,
      source_type: line.source_type,
      source_id: line.source_id,
      label: line.label,
      quantity: line.quantity,
      unit_amount: line.unit_amount,
      tax_rate: line.tax_rate,
      tax_included: line.tax_included,
      line_subtotal: line.line_subtotal,
      line_tax: line.line_tax,
      line_total: line.line_total,
      sort_order: line.sort_order + index,
      metadata: line.metadata,
    }))

    const { error: lineInsertError } = await supabase.from('invoice_lines').insert(insertLines)

    if (lineInsertError) {
      await supabase.from('invoices').delete().eq('store_id', storeId).eq('id', invoice.id)
      return NextResponse.json({ message: lineInsertError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        invoice,
        lines_count: insertLines.length,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ message }, { status })
  }
}
