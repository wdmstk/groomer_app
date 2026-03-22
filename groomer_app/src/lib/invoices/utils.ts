import type { UnknownObject } from '@/lib/object-utils'

export function parseOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

export function parseDiscountAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed))
    }
  }
  return 0
}

export function toUnknownObject(value: unknown): UnknownObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as UnknownObject
}

export function calculateTaxLine(params: {
  quantity: number
  unitAmount: number
  taxRate: number
  taxIncluded: boolean
}) {
  const quantity = Number.isFinite(params.quantity) ? Math.max(0, params.quantity) : 0
  const unitAmount = Number.isFinite(params.unitAmount) ? Math.max(0, params.unitAmount) : 0
  const taxRate = Number.isFinite(params.taxRate) ? Math.max(0, params.taxRate) : 0
  const gross = quantity * unitAmount

  if (params.taxIncluded) {
    const subtotal = gross / (1 + taxRate)
    const tax = gross - subtotal
    return {
      lineSubtotal: Math.round(subtotal),
      lineTax: Math.round(tax),
      lineTotal: Math.round(gross),
    }
  }

  const tax = gross * taxRate
  return {
    lineSubtotal: Math.round(gross),
    lineTax: Math.round(tax),
    lineTotal: Math.round(gross + tax),
  }
}
