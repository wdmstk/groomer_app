export function canEditInvoiceStatus(status: string | null | undefined) {
  return status === 'draft' || status === 'open'
}

export function normalizeRequestedInvoiceStatus(status: string | null) {
  if (!status) return null
  if (status === 'draft' || status === 'open') return status
  return null
}

export function summarizeInvoiceLines(lines: Array<{ line_subtotal: number; line_tax: number; line_total: number }>) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += Number(line.line_subtotal ?? 0)
      acc.tax += Number(line.line_tax ?? 0)
      acc.total += Number(line.line_total ?? 0)
      return acc
    },
    { subtotal: 0, tax: 0, total: 0 }
  )
}

export function calculateInvoiceTotalAfterDiscount(total: number, discountAmount: number) {
  return Math.max(0, total - discountAmount)
}
