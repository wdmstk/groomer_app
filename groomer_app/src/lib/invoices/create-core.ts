import type { UnknownObject } from '@/lib/object-utils'
import { calculateTaxLine } from '@/lib/invoices/utils'

export type InvoiceLineDraft = {
  source_type: 'appointment_menu' | 'hotel_stay_item' | 'manual_adjustment'
  source_id: string | null
  label: string
  quantity: number
  unit_amount: number
  tax_rate: number
  tax_included: boolean
  line_subtotal: number
  line_tax: number
  line_total: number
  sort_order: number
  metadata: UnknownObject
}

export function validateInvoiceCreateInput(params: {
  customerId: string | null
  appointmentIds: string[]
  hotelStayIds: string[]
}) {
  if (!params.customerId) {
    return 'customer_id is required.'
  }

  if (params.appointmentIds.length === 0 && params.hotelStayIds.length === 0) {
    return 'appointment_ids or hotel_stay_ids is required.'
  }

  return null
}

export function sumInvoice(lines: InvoiceLineDraft[]) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += line.line_subtotal
      acc.tax += line.line_tax
      acc.total += line.line_total
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 }
  )
}

export function hasCustomerMismatch(values: Array<string | null | undefined>, customerId: string) {
  return values.some((value) => (value ?? null) !== customerId)
}

export function buildAppointmentMenuLineDraft(row: {
  id: string
  appointment_id: string
  menu_id: string | null
  menu_name: string | null
  price: number | null
  tax_rate: number | null
  tax_included: boolean | null
}): InvoiceLineDraft {
  const unitAmount = Number(row.price ?? 0)
  const taxRate = Number(row.tax_rate ?? 0.1)
  const taxIncluded = Boolean(row.tax_included ?? true)
  const taxLine = calculateTaxLine({
    quantity: 1,
    unitAmount,
    taxRate,
    taxIncluded,
  })

  return {
    source_type: 'appointment_menu',
    source_id: row.id,
    label: row.menu_name ?? '施術メニュー',
    quantity: 1,
    unit_amount: unitAmount,
    tax_rate: taxRate,
    tax_included: taxIncluded,
    line_subtotal: taxLine.lineSubtotal,
    line_tax: taxLine.lineTax,
    line_total: taxLine.lineTotal,
    sort_order: 100,
    metadata: {
      appointment_id: row.appointment_id,
      menu_id: row.menu_id,
    },
  }
}

export function buildHotelStayItemLineDraft(row: UnknownObject): InvoiceLineDraft {
  return {
    source_type: 'hotel_stay_item',
    source_id: String(row.id ?? ''),
    label: String(row.label_snapshot ?? 'ホテル明細'),
    quantity: Number(row.quantity ?? 1),
    unit_amount: Number(row.unit_price_snapshot ?? 0),
    tax_rate: Number(row.tax_rate_snapshot ?? 0.1),
    tax_included: Boolean(row.tax_included_snapshot ?? true),
    line_subtotal: Math.round(Number(row.line_amount_jpy ?? 0)),
    line_tax: 0,
    line_total: Math.round(Number(row.line_amount_jpy ?? 0)),
    sort_order: 200,
    metadata: {
      stay_id: row.stay_id ?? null,
    },
  }
}
