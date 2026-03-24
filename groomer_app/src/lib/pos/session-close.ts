import { toNumber } from '@/lib/inventory/stock'

export type PosSessionOrderSummaryRow = {
  id: string
  total_amount: number
}

export type PosSessionOrderPaymentRow = {
  order_id: string
  method: string
}

export type PosCashDrawerEventRow = {
  event_type: 'cash_in' | 'cash_out' | 'adjustment'
  amount: number
}

export type PosSessionCloseSummary = {
  sales_total: number
  cash_expected: number
  cash_counted: number
  cash_diff: number
  cash_sales: number
  cash_in_total: number
  cash_out_total: number
  adjustment_total: number
}

export function computePosSessionCloseSummary(params: {
  confirmedOrders: PosSessionOrderSummaryRow[]
  confirmPayments: PosSessionOrderPaymentRow[]
  drawerEvents: PosCashDrawerEventRow[]
  cashCountedAmount: number
}): PosSessionCloseSummary {
  const salesTotal = params.confirmedOrders.reduce((sum, row) => sum + Math.round(toNumber(row.total_amount)), 0)

  const cashOrderIds = new Set(params.confirmPayments.filter((row) => row.method === '現金').map((row) => row.order_id))
  const cashSales = params.confirmedOrders
    .filter((row) => cashOrderIds.has(row.id))
    .reduce((sum, row) => sum + Math.round(toNumber(row.total_amount)), 0)

  let cashInTotal = 0
  let cashOutTotal = 0
  let adjustmentTotal = 0
  params.drawerEvents.forEach((row) => {
    const amount = Math.round(toNumber(row.amount))
    if (row.event_type === 'cash_in') cashInTotal += amount
    else if (row.event_type === 'cash_out') cashOutTotal += amount
    else adjustmentTotal += amount
  })

  const cashExpected = cashSales + cashInTotal - cashOutTotal + adjustmentTotal

  return {
    sales_total: salesTotal,
    cash_expected: cashExpected,
    cash_counted: Math.round(toNumber(params.cashCountedAmount)),
    cash_diff: Math.round(toNumber(params.cashCountedAmount)) - cashExpected,
    cash_sales: cashSales,
    cash_in_total: cashInTotal,
    cash_out_total: cashOutTotal,
    adjustment_total: adjustmentTotal,
  }
}
