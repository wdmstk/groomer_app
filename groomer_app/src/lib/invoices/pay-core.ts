import { asObjectOrNull } from '@/lib/object-utils'
import { parseOptionalString } from '@/lib/invoices/utils'

export type InvoiceLineForPay = {
  source_type: string
  metadata: unknown
}

export type HotelStayForPay = {
  appointment_id: string | null
}

export function extractAppointmentIdFromMetadata(metadata: unknown) {
  const object = asObjectOrNull(metadata)
  return parseOptionalString(object?.appointment_id)
}

export function extractStayIdFromMetadata(metadata: unknown) {
  const object = asObjectOrNull(metadata)
  return parseOptionalString(object?.stay_id)
}

export function collectStayIdsFromInvoiceLines(lines: InvoiceLineForPay[]) {
  return Array.from(
    new Set(
      lines
        .filter((line) => line.source_type === 'hotel_stay_item')
        .map((line) => extractStayIdFromMetadata(line.metadata))
        .filter(Boolean)
    )
  ) as string[]
}

export function resolveAppointmentIdFromInvoiceLines(params: {
  lines: InvoiceLineForPay[]
  hotelStays?: HotelStayForPay[]
}) {
  const fromAppointmentLine = params.lines
    .filter((line) => line.source_type === 'appointment_menu')
    .map((line) => extractAppointmentIdFromMetadata(line.metadata))
    .find(Boolean)

  if (fromAppointmentLine) {
    return fromAppointmentLine
  }

  const fromHotelStay = (params.hotelStays ?? [])
    .map((stay) => parseOptionalString(stay.appointment_id))
    .find(Boolean)

  return fromHotelStay ?? null
}

export function canInvoiceBePaid(params: { status: string; existingPaymentId?: string | null }) {
  if (params.existingPaymentId) {
    return { ok: true as const, reused: true as const }
  }
  if (params.status === 'paid') {
    return { ok: false as const, code: 'ALREADY_PAID' as const }
  }
  if (params.status === 'void') {
    return { ok: false as const, code: 'VOID_NOT_PAYABLE' as const }
  }
  return { ok: true as const, reused: false as const }
}

export function isInvoiceCustomerMismatch(params: {
  invoiceCustomerId: string
  appointmentCustomerId: string | null | undefined
}) {
  return !params.appointmentCustomerId || params.invoiceCustomerId !== params.appointmentCustomerId
}
