import { toNumber } from '@/lib/inventory/stock'

export type ReorderSuggestionRow = {
  item_id: string
  item_name: string
  category: string | null
  unit: string
  supplier_name: string | null
  current_stock: number | null
  reorder_point: number | null
  optimal_stock: number | null
  minimum_order_quantity: number | null
  order_lot_size: number | null
  lead_time_days: number | null
  last_inbound_unit_cost: number | null
  recommended_quantity: number | null
  priority_rank: number | null
}

export function normalizeSupplierName(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : '未設定仕入先'
}

export function normalizeSuggestedQuantity(
  rawValue: string | number | null | undefined,
  fallbackValue: number | null | undefined,
  minimumOrderQuantity: number | null | undefined,
  orderLotSize: number | null | undefined
) {
  const requested = Math.max(0, toNumber(rawValue ?? fallbackValue ?? 0))
  if (requested <= 0) return 0

  const minimumApplied = Math.max(requested, Math.max(0, toNumber(minimumOrderQuantity)))
  const lotSize = Math.max(0, toNumber(orderLotSize))
  if (lotSize <= 0) return minimumApplied
  return Math.ceil(minimumApplied / lotSize) * lotSize
}

export function generatePurchaseOrderNo() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const suffix = `${Math.floor(Math.random() * 9000) + 1000}`
  return `PO-${y}${m}${d}-${suffix}`
}

export function calculateExpectedOnIso(leadTimeDays: number | null | undefined) {
  const normalizedLeadTime = Math.max(0, Math.floor(toNumber(leadTimeDays)))
  if (normalizedLeadTime <= 0) return null
  const date = new Date()
  date.setDate(date.getDate() + normalizedLeadTime)
  return date.toISOString().slice(0, 10)
}

export function groupSuggestionsBySupplier<T extends { supplier_name: string | null }>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = normalizeSupplierName(row.supplier_name)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return groups
}
