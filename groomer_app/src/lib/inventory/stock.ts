export type StockMovement = {
  item_id: string
  quantity_delta: number | string | null
}

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function aggregateStockByItem(movements: StockMovement[]) {
  const stockByItemId = new Map<string, number>()
  for (const movement of movements) {
    const current = stockByItemId.get(movement.item_id) ?? 0
    stockByItemId.set(movement.item_id, current + toNumber(movement.quantity_delta))
  }
  return stockByItemId
}
