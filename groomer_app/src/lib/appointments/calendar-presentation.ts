export type DelayAlertPayload = {
  baseEndTime?: string | null
  scenarios?: Array<{
    offsetMin?: number
    impactedCount?: number
    impacts?: Array<{
      appointmentId?: string
      startTime?: string | null
      endTime?: string | null
      customerName?: string
      petName?: string
      overlapMin?: number
    }>
  }>
}

export type DisplayDelayAlert = {
  baseEndTime: string
  lines: string[]
}

export function formatCalendarConflictJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatCalendarTimeJst(value: string | null | undefined) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function isRequestedAppointmentStatus(status: string) {
  return status === '予約申請'
}

export function parseCalendarDelayAlertPayload(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DelayAlertPayload
    const baseEndTime = parsed.baseEndTime
    const scenarios = parsed.scenarios ?? []
    if (!baseEndTime || scenarios.length === 0) return null

    const lines = scenarios
      .filter((scenario) => (scenario.impactedCount ?? 0) > 0)
      .map((scenario) => {
        const firstImpact = scenario.impacts?.[0]
        const firstLabel = firstImpact
          ? `${formatCalendarTimeJst(firstImpact.startTime)} ${firstImpact.petName ?? '未登録'} (${firstImpact.customerName ?? '未登録'})`
          : '影響先未取得'
        return `+${scenario.offsetMin ?? 0}分: ${scenario.impactedCount ?? 0}件影響 (${firstLabel})`
      })

    if (lines.length === 0) return null
    return { baseEndTime, lines } satisfies DisplayDelayAlert
  } catch {
    return null
  }
}
