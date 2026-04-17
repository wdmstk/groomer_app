export type AttendanceEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

type AttendanceEventRow = {
  event_type: AttendanceEventType
  occurred_at: string
}

type AttendanceSummary = {
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  worked_minutes: number
  status: 'complete' | 'incomplete' | 'needs_review'
  flags: Record<string, boolean>
}

export function summarizeAttendanceEvents(events: AttendanceEventRow[]): AttendanceSummary {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  let clockInAt: string | null = null
  let clockOutAt: string | null = null
  let breakMinutes = 0
  let breakStartMs: number | null = null
  let invalidOrder = false

  for (const event of sorted) {
    const atMs = new Date(event.occurred_at).getTime()
    if (!Number.isFinite(atMs)) continue

    if (event.event_type === 'clock_in') {
      if (!clockInAt) clockInAt = event.occurred_at
      continue
    }
    if (event.event_type === 'clock_out') {
      clockOutAt = event.occurred_at
      continue
    }
    if (event.event_type === 'break_start') {
      if (!clockInAt || breakStartMs !== null) {
        invalidOrder = true
        continue
      }
      breakStartMs = atMs
      continue
    }
    if (event.event_type === 'break_end') {
      if (breakStartMs === null || atMs <= breakStartMs) {
        invalidOrder = true
        continue
      }
      breakMinutes += Math.floor((atMs - breakStartMs) / 60000)
      breakStartMs = null
    }
  }

  const startMs = clockInAt ? new Date(clockInAt).getTime() : NaN
  const endMs = clockOutAt ? new Date(clockOutAt).getTime() : NaN
  const hasCompleteClock = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
  const totalMinutes = hasCompleteClock ? Math.floor((endMs - startMs) / 60000) : 0
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes)

  const needsReview = invalidOrder || breakStartMs !== null
  const status: AttendanceSummary['status'] = hasCompleteClock
    ? needsReview
      ? 'needs_review'
      : 'complete'
    : sorted.length > 0
      ? 'incomplete'
      : 'incomplete'

  return {
    clock_in_at: clockInAt,
    clock_out_at: clockOutAt,
    break_minutes: breakMinutes,
    worked_minutes: workedMinutes,
    status,
    flags: {
      invalid_order: invalidOrder,
      open_break: breakStartMs !== null,
      missing_clock: !hasCompleteClock,
    },
  }
}

export async function recomputeAttendanceDailySummary(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  storeId: string
  staffId: string
  businessDate: string
}) {
  const { db, storeId, staffId, businessDate } = params
  const { data: eventRows, error: eventsError } = await db
    .from('attendance_events')
    .select('event_type, occurred_at')
    .eq('store_id', storeId)
    .eq('staff_id', staffId)
    .eq('business_date', businessDate)
    .order('occurred_at', { ascending: true })

  if (eventsError) throw new Error(eventsError.message)

  const summary = summarizeAttendanceEvents(
    ((eventRows ?? []) as Array<{ event_type: AttendanceEventType; occurred_at: string }>).map(
      (row) => ({
        event_type: row.event_type,
        occurred_at: row.occurred_at,
      })
    )
  )

  const { error: upsertError } = await db.from('attendance_daily_summaries').upsert(
    {
      store_id: storeId,
      staff_id: staffId,
      business_date: businessDate,
      clock_in_at: summary.clock_in_at,
      clock_out_at: summary.clock_out_at,
      break_minutes: summary.break_minutes,
      worked_minutes: summary.worked_minutes,
      status: summary.status,
      flags: summary.flags,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id,staff_id,business_date' }
  )
  if (upsertError) throw new Error(upsertError.message)

  return summary
}
