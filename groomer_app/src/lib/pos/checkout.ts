export type PosCartLineInput = {
  quantity: number
  unitAmount: number
  taxRate: number
  taxIncluded: boolean
}

export type PosCartTotals = {
  subtotal: number
  tax: number
  discount: number
  total: number
}

function toNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export function calculatePosCartTotals(lines: PosCartLineInput[], discountAmount: number): PosCartTotals {
  const discount = toNonNegative(discountAmount)
  const summary = lines.reduce(
    (acc, line) => {
      const qty = toNonNegative(line.quantity)
      const unit = toNonNegative(line.unitAmount)
      const taxRate = toNonNegative(line.taxRate)
      const rowTotal = qty * unit
      if (line.taxIncluded) {
        const base = rowTotal / (1 + taxRate)
        const tax = rowTotal - base
        acc.subtotal += base
        acc.tax += tax
      } else {
        const tax = rowTotal * taxRate
        acc.subtotal += rowTotal
        acc.tax += tax
      }
      return acc
    },
    { subtotal: 0, tax: 0 }
  )

  const gross = summary.subtotal + summary.tax
  const total = Math.max(0, gross - discount)
  return {
    subtotal: Math.round(summary.subtotal),
    tax: Math.round(summary.tax),
    discount: Math.round(discount),
    total: Math.round(total),
  }
}
