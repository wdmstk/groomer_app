type NotificationLogRow = {
  store_id: string
  id: string
  dedupe_key: string | null
}

type StoreLimitConfig = {
  monthlyLimit: number
  monthlyLimitWithOption: number
  optionEnabled: boolean
}

export function getPreviousMonthJstPeriod(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.format(baseDate).split('-')
  const year = Number.parseInt(parts[0] ?? '', 10)
  const month = Number.parseInt(parts[1] ?? '', 10)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const monthJst = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const periodStart = new Date(`${monthJst}T00:00:00+09:00`)
  const thisMonthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`)
  const periodEnd = new Date(thisMonthStart.getTime() - 1)
  return {
    monthJst,
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString(),
  }
}

export function countUniqueSentMessagesByStore(rows: NotificationLogRow[]) {
  const byStore = new Map<string, Set<string>>()

  for (const row of rows) {
    const uniqueKey = row.dedupe_key ?? `id:${row.id}`
    const current = byStore.get(row.store_id) ?? new Set<string>()
    current.add(uniqueKey)
    byStore.set(row.store_id, current)
  }

  const result = new Map<string, number>()
  for (const [storeId, set] of byStore.entries()) {
    result.set(storeId, set.size)
  }
  return result
}

export function calculateNotificationUsageCharge(params: {
  sentCount: number
  config: StoreLimitConfig
  unitPriceJpy?: number
}) {
  const sent = Math.max(0, Math.floor(params.sentCount))
  const monthlyLimit = Math.max(0, Math.floor(params.config.monthlyLimit))
  const monthlyLimitWithOption = Math.max(monthlyLimit, Math.floor(params.config.monthlyLimitWithOption))
  const appliedLimit = params.config.optionEnabled ? monthlyLimitWithOption : monthlyLimit
  const billableMessages = Math.max(0, sent - appliedLimit)
  const unitPriceJpy = Math.max(0, Math.floor(params.unitPriceJpy ?? 3))
  const amountJpy = billableMessages * unitPriceJpy

  return {
    countedSentMessages: sent,
    appliedLimit,
    billableMessages,
    unitPriceJpy,
    amountJpy,
  }
}
