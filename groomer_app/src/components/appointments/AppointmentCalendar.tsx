'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DragEvent, MouseEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  formatCalendarConflictJst,
  formatCalendarTimeJst,
  isRequestedAppointmentStatus,
  parseCalendarDelayAlertPayload,
  type DelayAlertPayload,
  type DisplayDelayAlert,
} from '@/lib/appointments/calendar-presentation'
import { APPOINTMENT_METRIC_EVENTS } from '@/lib/appointments/metrics'

type CalendarAppointment = {
  id: string
  customerName: string
  petName: string
  staffId: string
  staffName: string
  startTime: string
  endTime: string
  menu: string
  status: string
}

type AppointmentCalendarProps = {
  appointments: CalendarAppointment[]
  initialDelayAlert?: DisplayDelayAlert | null
}

type CalendarMode = 'month' | 'week' | 'day'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const weekLabels = ['月', '火', '水', '木', '金', '土', '日']
const HOUR_WIDTH = 72
const STAFF_ROW_HEIGHT = 72
const staffColorPalette = [
  { light: 'bg-sky-50 text-sky-800', block: 'border-sky-200 bg-sky-50 text-sky-900' },
  { light: 'bg-emerald-50 text-emerald-800', block: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  { light: 'bg-violet-50 text-violet-800', block: 'border-violet-200 bg-violet-50 text-violet-900' },
  { light: 'bg-pink-50 text-pink-800', block: 'border-pink-200 bg-pink-50 text-pink-900' },
  { light: 'bg-cyan-50 text-cyan-800', block: 'border-cyan-200 bg-cyan-50 text-cyan-900' },
  { light: 'bg-lime-50 text-lime-800', block: 'border-lime-200 bg-lime-50 text-lime-900' },
]

type NormalizedAppointment = CalendarAppointment & {
  start: Date
  end: Date
}

type LanePlacedAppointment = {
  item: NormalizedAppointment
  lane: number
}

type StaffLanePlacedAppointment = {
  item: NormalizedAppointment
  staffIndex: number
  lane: number
  lanesInStaff: number
}

type DraggedPayload = {
  appointmentId: string
  durationMin: number
  fallbackStaffId: string
}

function getJstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  }
}

function createDateFromJst(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - JST_OFFSET_MS)
}

function addDaysJst(date: Date, days: number) {
  const p = getJstParts(date)
  return createDateFromJst(p.year, p.month, p.day + days, p.hour, p.minute)
}

function readDelayAlertFromSessionStorage() {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem('appointment_delay_alert')
  const parsed = parseCalendarDelayAlertPayload(raw)
  if (parsed) {
    window.sessionStorage.removeItem('appointment_delay_alert')
  }
  return parsed
}

function startOfJstDay(date: Date) {
  const p = getJstParts(date)
  return createDateFromJst(p.year, p.month, p.day)
}

function toJstDateKey(date: Date) {
  const p = getJstParts(date)
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

function formatJstTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatJstDate(value: Date) {
  const p = getJstParts(value)
  return `${p.year}/${String(p.month + 1).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`
}

function getMinutesFromJstDayStart(date: Date) {
  const p = getJstParts(date)
  return p.hour * 60 + p.minute
}

function getTimelinePlacement(item: NormalizedAppointment) {
  const startMin = getMinutesFromJstDayStart(item.start)
  const endMinRaw = getMinutesFromJstDayStart(item.end)
  const endMin = endMinRaw > startMin ? endMinRaw : startMin + 30
  const clampedStart = Math.max(0, Math.min(startMin, 24 * 60))
  const clampedEnd = Math.max(0, Math.min(endMin, 24 * 60))
  const left = (clampedStart / 60) * HOUR_WIDTH
  const width = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_WIDTH, 56)
  return { startMin: clampedStart, endMin: clampedEnd, left, width }
}

function assignLanes(dayAppointments: NormalizedAppointment[]) {
  const sorted = [...dayAppointments].sort((a, b) => a.start.getTime() - b.start.getTime())
  const laneEnds: number[] = []
  const placed: LanePlacedAppointment[] = []

  sorted.forEach((item) => {
    const { startMin, endMin } = getTimelinePlacement(item)
    let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= startMin)
    if (laneIndex === -1) {
      laneIndex = laneEnds.length
      laneEnds.push(endMin)
    } else {
      laneEnds[laneIndex] = endMin
    }
    placed.push({ item, lane: laneIndex })
  })

  return {
    placed,
    totalLanes: Math.max(1, laneEnds.length),
  }
}

function assignStaffLanes(dayAppointments: NormalizedAppointment[], staffNames: string[]) {
  const normalizedStaffNames = staffNames.length > 0 ? staffNames : ['スタッフ未設定']
  const staffIndexMap = new Map<string, number>()
  normalizedStaffNames.forEach((name, index) => {
    staffIndexMap.set(name, index)
  })

  const grouped: NormalizedAppointment[][] = normalizedStaffNames.map(() => [])
  dayAppointments.forEach((item) => {
    const staffIndex = staffIndexMap.get(item.staffName) ?? 0
    grouped[staffIndex].push(item)
  })

  const lanesCountByStaff = normalizedStaffNames.map(() => 1)
  const placed: Array<{ item: NormalizedAppointment; staffIndex: number; lane: number }> = []

  grouped.forEach((items, staffIndex) => {
    const laneData = assignLanes(items)
    lanesCountByStaff[staffIndex] = Math.max(1, laneData.totalLanes)
    laneData.placed.forEach(({ item, lane }) => {
      placed.push({ item, staffIndex, lane })
    })
  })

  return {
    totalStaff: normalizedStaffNames.length,
    lanesCountByStaff,
    placed: placed.map((row) => ({
      ...row,
      lanesInStaff: lanesCountByStaff[row.staffIndex] ?? 1,
    })) as StaffLanePlacedAppointment[],
  }
}

function roundTo15(minute: number) {
  return Math.max(0, Math.min(24 * 60 - 15, Math.round(minute / 15) * 15))
}

function sendMoveMetric(elapsedMs: number, succeeded: boolean) {
  const payload = {
    event_type: APPOINTMENT_METRIC_EVENTS.sameDayMoveResponse,
    mode: 'edit',
    elapsed_ms: Math.max(0, elapsedMs),
    click_count: 0,
    field_change_count: 0,
    selected_menu_count: 0,
    used_template_copy: false,
    succeeded,
  }
  const body = JSON.stringify(payload)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon('/api/metrics/appointments', blob)
    return
  }
  void fetch('/api/metrics/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}

export function AppointmentCalendar({ appointments, initialDelayAlert = null }: AppointmentCalendarProps) {
  const router = useRouter()
  const ignoreClickUntilRef = useRef(0)
  const [calendarAppointments, setCalendarAppointments] = useState(appointments)
  const [mode, setMode] = useState<CalendarMode>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [dragError, setDragError] = useState('')
  const [delayAlert, setDelayAlert] = useState<DisplayDelayAlert | null>(() =>
    initialDelayAlert ?? readDelayAlertFromSessionStorage()
  )
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<string | null>(null)

  const normalized = useMemo<NormalizedAppointment[]>(() => {
    return calendarAppointments
      .map((item) => ({
        ...item,
        start: new Date(item.startTime),
        end: new Date(item.endTime),
      }))
      .filter((item) => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [calendarAppointments])

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, (typeof normalized)[number][]>()
    normalized.forEach((item) => {
      const key = toJstDateKey(item.start)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    })
    return map
  }, [normalized])

  const staffColorMap = useMemo(() => {
    const map = new Map<string, number>()
    normalized.forEach((item) => {
      if (!map.has(item.staffName)) {
        map.set(item.staffName, map.size % staffColorPalette.length)
      }
    })
    return map
  }, [normalized])
  const staffNames = useMemo(() => Array.from(staffColorMap.keys()), [staffColorMap])
  const staffEntries = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    normalized.forEach((item) => {
      if (!map.has(item.staffName)) {
        map.set(item.staffName, { id: item.staffId, name: item.staffName })
      }
    })
    const entries = Array.from(map.values())
    return entries.length > 0 ? entries : [{ id: '', name: 'スタッフ未設定' }]
  }, [normalized])

  const getItemColorClass = (item: NormalizedAppointment, modeType: 'light' | 'block') => {
    if (isRequestedAppointmentStatus(item.status)) {
      return modeType === 'light'
        ? 'bg-amber-100 text-amber-900'
        : 'border-amber-300 bg-amber-100 text-amber-900'
    }
    const index = staffColorMap.get(item.staffName) ?? 0
    return modeType === 'light'
      ? staffColorPalette[index].light
      : staffColorPalette[index].block
  }

  const title = useMemo(() => {
    if (mode === 'month') {
      const p = getJstParts(cursor)
      return `${p.year}年${p.month + 1}月`
    }

    if (mode === 'week') {
      const p = getJstParts(cursor)
      const weekStart = addDaysJst(startOfJstDay(cursor), -((p.weekday + 6) % 7))
      const weekEnd = addDaysJst(weekStart, 6)
      return `${formatJstDate(weekStart)} - ${formatJstDate(weekEnd)}`
    }

    return formatJstDate(cursor)
  }, [cursor, mode])

  const move = (delta: number) => {
    if (mode === 'month') {
      const p = getJstParts(cursor)
      setCursor(createDateFromJst(p.year, p.month + delta, 1))
      return
    }

    if (mode === 'week') {
      setCursor((prev) => addDaysJst(prev, delta * 7))
      return
    }

    setCursor((prev) => addDaysJst(prev, delta))
  }

  const monthCells = useMemo(() => {
    const p = getJstParts(cursor)
    const monthStart = createDateFromJst(p.year, p.month, 1)
    const startOffset = (getJstParts(monthStart).weekday + 6) % 7
    const startCell = addDaysJst(monthStart, -startOffset)
    return Array.from({ length: 42 }, (_, index) => addDaysJst(startCell, index))
  }, [cursor])

  const weekDays = useMemo(() => {
    const p = getJstParts(cursor)
    const weekStart = addDaysJst(startOfJstDay(cursor), -((p.weekday + 6) % 7))
    return Array.from({ length: 7 }, (_, index) => addDaysJst(weekStart, index))
  }, [cursor])

  const dayKey = toJstDateKey(startOfJstDay(cursor))
  const timelineWidth = 24 * HOUR_WIDTH

  const handleDragStart = (event: DragEvent<HTMLElement>, item: NormalizedAppointment) => {
    const durationMin = Math.max(
      15,
      Math.round((item.end.getTime() - item.start.getTime()) / (60 * 1000))
    )
    const payload: DraggedPayload = {
      appointmentId: item.id,
      durationMin,
      fallbackStaffId: item.staffId,
    }
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
    ignoreClickUntilRef.current = event.timeStamp + 350
    setDraggingAppointmentId(item.id)
    setDragError('')
  }

  const handleDragEnd = () => {
    setDraggingAppointmentId(null)
  }

  const openAppointmentEditor = (appointmentId: string) => {
    router.push(`/appointments?tab=calendar&edit=${appointmentId}`)
  }

  const handleChipClick = (event: MouseEvent<HTMLElement>, appointmentId: string) => {
    if (event.timeStamp < ignoreClickUntilRef.current) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    openAppointmentEditor(appointmentId)
  }

  const handleChipDoubleClick = (event: MouseEvent<HTMLElement>, appointmentId: string) => {
    event.preventDefault()
    openAppointmentEditor(appointmentId)
  }

  const handleDropOnTimeline = async (
    event: DragEvent<HTMLDivElement>,
    dayDate: Date,
    staffCount: number
  ) => {
    event.preventDefault()
    const dropTimeStamp = event.timeStamp
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return
    const payload = JSON.parse(raw) as DraggedPayload
    const container = event.currentTarget
    const rect = container.getBoundingClientRect()
    const relativeX = event.clientX - rect.left
    const minuteRatio = relativeX / rect.width
    const startMinute = roundTo15(minuteRatio * 24 * 60)
    const dayStart = startOfJstDay(dayDate).getTime()
    const startDate = new Date(dayStart + startMinute * 60 * 1000)
    const endDate = new Date(startDate.getTime() + payload.durationMin * 60 * 1000)

    const relativeY = Math.max(0, Math.min(event.clientY - rect.top, rect.height - 1))
    const staffIndex = Math.min(
      Math.max(0, Math.floor((relativeY / rect.height) * staffCount)),
      staffCount - 1
    )
    const staffId = staffEntries[staffIndex]?.id || payload.fallbackStaffId

    const response = await fetch(`/api/appointments/${payload.appointmentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        staff_id: staffId,
      }),
    })
    const responsePayload = (await response.json().catch(() => null)) as
      | {
          message?: string
          processing_ms?: number
          conflict?: { startTime?: string | null; endTime?: string | null } | null
          delay_alert?: DelayAlertPayload | null
        }
      | null
    const processingMs = typeof responsePayload?.processing_ms === 'number' ? responsePayload.processing_ms : 0

    if (response.ok) {
      ignoreClickUntilRef.current = dropTimeStamp + 350
      const movedStaffName = staffEntries.find((staff) => staff.id === staffId)?.name ?? 'スタッフ未設定'
      setCalendarAppointments((prev) =>
        prev.map((item) =>
          item.id === payload.appointmentId
            ? {
                ...item,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                staffId,
                staffName: movedStaffName,
              }
            : item
        )
      )
      setDragError('')
      setDelayAlert(parseCalendarDelayAlertPayload(JSON.stringify(responsePayload?.delay_alert ?? null)))
      sendMoveMetric(processingMs, true)
      return
    }
    sendMoveMetric(processingMs, false)

    const errorPayload = responsePayload
    if (response.status === 409) {
      const conflict = errorPayload?.conflict
      setDragError(
        `${errorPayload?.message ?? '時間が重複するため移動できません。'} ` +
          `衝突: ${formatCalendarConflictJst(conflict?.startTime)} - ${formatCalendarConflictJst(conflict?.endTime)}`
      )
    } else {
      setDragError(errorPayload?.message ?? '移動に失敗しました。')
    }
  }

  return (
    <div className="space-y-4">
      {delayAlert ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">
            遅延影響アラート: 終了予定 {formatCalendarConflictJst(delayAlert.baseEndTime)} 以降
          </p>
          <p>{delayAlert.lines.join(' / ')}</p>
        </div>
      ) : null}
      {dragError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dragError}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            前
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            今日
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            次
          </button>
        </div>

        <p className="text-sm font-semibold text-gray-900">{title} (JST)</p>

        <div className="flex items-center gap-2">
          {(['month', 'week', 'day'] as CalendarMode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded px-3 py-1.5 text-sm ${
                mode === value
                  ? 'bg-blue-600 text-white'
                  : 'border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {value === 'month' ? '月' : value === 'week' ? '週' : '日'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-amber-300 bg-amber-100 px-2 py-1 text-amber-900">
          予約申請
        </span>
        {Array.from(staffColorMap.entries()).map(([staffName, index]) => (
          <span
            key={staffName}
            className={`rounded border px-2 py-1 ${staffColorPalette[index].block}`}
          >
            確定: {staffName}
          </span>
        ))}
      </div>

      {mode === 'month' && (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500">
            {weekLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((date) => {
              const p = getJstParts(date)
              const cursorParts = getJstParts(cursor)
              const isCurrentMonth = p.month === cursorParts.month
              const key = toJstDateKey(date)
              const dayAppointments = appointmentsByDay.get(key) ?? []

              return (
                <div
                  key={key}
                  className={`min-h-28 rounded border p-2 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  <p className="text-xs font-semibold">{p.day}</p>
                  <div className="mt-1 space-y-1">
                    {dayAppointments.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        href={`/appointments?tab=calendar&edit=${item.id}`}
                        className={`rounded px-1.5 py-1 text-[11px] ${getItemColorClass(item, 'light')}`}
                        onClick={(event) => handleChipClick(event, item.id)}
                        onDoubleClick={(event) => handleChipDoubleClick(event, item.id)}
                      >
                        {formatJstTime(item.startTime)} {item.petName}
                      </Link>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-[11px] text-gray-500">+{dayAppointments.length - 3} 件</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'week' && (
        <div className="overflow-x-auto">
          <div className="min-w-[1900px] rounded border bg-white">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] border-b bg-gray-50 text-xs font-semibold text-gray-600">
              <div className="border-r px-2 py-2">日付</div>
              <div className="relative" style={{ width: `${timelineWidth}px`, height: '36px' }}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={`week-header-hour-${hour}`}
                    className="absolute top-0 text-[11px] text-gray-500"
                    style={{ left: `${hour * HOUR_WIDTH + 4}px` }}
                  >
                    {`${String(hour).padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
            </div>

            {weekDays.map((date, idx) => {
              const key = toJstDateKey(date)
              const dayAppointments = appointmentsByDay.get(key) ?? []
              const staffLaneData = assignStaffLanes(dayAppointments, staffNames)
              const staffSectionHeight = STAFF_ROW_HEIGHT
              const totalHeight = Math.max(staffLaneData.totalStaff * staffSectionHeight, STAFF_ROW_HEIGHT)

              return (
                <div key={key} className="grid grid-cols-[88px_minmax(0,1fr)] border-b last:border-b-0">
                  <div className="border-r bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-600">
                    {weekLabels[idx]} {getJstParts(date).day}日
                  </div>
                  <div
                    className="relative"
                    style={{ width: `${timelineWidth}px`, height: `${totalHeight}px` }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      void handleDropOnTimeline(event, date, staffLaneData.totalStaff)
                    }}
                  >
                    {Array.from({ length: 25 }, (_, hour) => (
                      <div
                        key={`${key}-hour-line-${hour}`}
                        className="absolute bottom-0 top-0 border-l border-gray-200"
                        style={{ left: `${hour * HOUR_WIDTH}px` }}
                      />
                    ))}
                    {Array.from({ length: Math.max(0, staffLaneData.totalStaff - 1) }, (_, idx2) => (
                      <div
                        key={`${key}-staff-separator-${idx2}`}
                        className="absolute left-0 right-0 border-t border-gray-200"
                        style={{ top: `${(idx2 + 1) * staffSectionHeight}px` }}
                      />
                    ))}
                    {staffLaneData.lanesCountByStaff.flatMap((count, staffIndex) =>
                      Array.from({ length: Math.max(0, count - 1) }, (_, laneBoundaryIndex) => {
                        const top =
                          staffSectionHeight * staffIndex +
                          ((laneBoundaryIndex + 1) / count) * staffSectionHeight
                        return (
                          <div
                            key={`${key}-lane-separator-${staffIndex}-${laneBoundaryIndex}`}
                            className="absolute left-0 right-0 border-t border-dashed border-gray-300"
                            style={{ top: `${top}px` }}
                          />
                        )
                      })
                    )}

                    {staffLaneData.placed.map(({ item, lane, staffIndex, lanesInStaff }) => {
                      const { left, width } = getTimelinePlacement(item)
                      const laneHeight = staffSectionHeight / lanesInStaff
                      const top = staffSectionHeight * staffIndex + laneHeight * lane + 2
                      const height = Math.max(laneHeight - 4, 18)

                      return (
                        <Link
                          key={item.id}
                          href={`/appointments?tab=calendar&edit=${item.id}`}
                          className={`absolute rounded border px-2 py-1 text-[11px] shadow-sm ${getItemColorClass(item, 'block')}`}
                          style={{
                            top: `${top}px`,
                            left: `${left}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            opacity: draggingAppointmentId === item.id ? 0.5 : 1,
                          }}
                          draggable
                          onClick={(event) => handleChipClick(event, item.id)}
                          onDoubleClick={(event) => handleChipDoubleClick(event, item.id)}
                          onDragStart={(event) => handleDragStart(event, item)}
                          onDragEnd={handleDragEnd}
                        >
                          <p className="font-semibold">
                            {formatCalendarTimeJst(item.startTime)}-{formatCalendarTimeJst(item.endTime)}
                          </p>
                          <p>{item.petName}</p>
                          <p className="text-blue-700">{item.staffName}</p>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'day' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">{formatJstDate(cursor)} のタイムテーブル</p>
          {(appointmentsByDay.get(dayKey) ?? []).length === 0 ? (
            <div className="rounded border bg-white p-4">
              <p className="text-sm text-gray-500">この日の予約はありません。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1900px] rounded border bg-white">
                <div className="grid grid-cols-[88px_minmax(0,1fr)] border-b bg-gray-50 text-xs font-semibold text-gray-600">
                  <div className="border-r px-2 py-2">日付</div>
                  <div className="relative" style={{ width: `${timelineWidth}px`, height: '36px' }}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={`day-header-hour-${hour}`}
                        className="absolute top-0 text-[11px] text-gray-500"
                        style={{ left: `${hour * HOUR_WIDTH + 4}px` }}
                      >
                        {`${String(hour).padStart(2, '0')}:00`}
                      </div>
                    ))}
                  </div>
                </div>
                {(() => {
                  const staffLaneData = assignStaffLanes(appointmentsByDay.get(dayKey) ?? [], staffNames)
                  const staffSectionHeight = STAFF_ROW_HEIGHT
                  const totalHeight = Math.max(staffLaneData.totalStaff * staffSectionHeight, STAFF_ROW_HEIGHT)
                  return (
                    <div className="grid grid-cols-[88px_minmax(0,1fr)]">
                      <div className="border-r bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-600">
                        {formatJstDate(cursor)}
                      </div>
                      <div
                        className="relative"
                        style={{ width: `${timelineWidth}px`, height: `${totalHeight}px` }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          void handleDropOnTimeline(event, cursor, staffLaneData.totalStaff)
                        }}
                      >
                        {Array.from({ length: 25 }, (_, hour) => (
                          <div
                            key={`day-line-${hour}`}
                            className="absolute bottom-0 top-0 border-l border-gray-200"
                            style={{ left: `${hour * HOUR_WIDTH}px` }}
                          />
                        ))}
                        {Array.from({ length: Math.max(0, staffLaneData.totalStaff - 1) }, (_, idx) => (
                          <div
                            key={`day-staff-separator-${idx}`}
                            className="absolute left-0 right-0 border-t border-gray-200"
                            style={{ top: `${(idx + 1) * staffSectionHeight}px` }}
                          />
                        ))}
                        {staffLaneData.lanesCountByStaff.flatMap((count, staffIndex) =>
                          Array.from({ length: Math.max(0, count - 1) }, (_, laneBoundaryIndex) => {
                            const top =
                              staffSectionHeight * staffIndex +
                              ((laneBoundaryIndex + 1) / count) * staffSectionHeight
                            return (
                              <div
                                key={`day-lane-separator-${staffIndex}-${laneBoundaryIndex}`}
                                className="absolute left-0 right-0 border-t border-dashed border-gray-300"
                                style={{ top: `${top}px` }}
                              />
                            )
                          })
                        )}
                        {staffLaneData.placed.map(({ item, lane, staffIndex, lanesInStaff }) => {
                          const { left, width } = getTimelinePlacement(item)
                          const laneHeight = staffSectionHeight / lanesInStaff
                          const top = staffSectionHeight * staffIndex + laneHeight * lane + 2
                          const height = Math.max(laneHeight - 4, 18)
                          return (
                            <Link
                              key={item.id}
                              href={`/appointments?tab=calendar&edit=${item.id}`}
                              className={`absolute rounded border px-2 py-1 text-[11px] shadow-sm ${getItemColorClass(item, 'block')}`}
                              style={{
                                top: `${top}px`,
                                left: `${left}px`,
                                width: `${width}px`,
                                height: `${height}px`,
                                opacity: draggingAppointmentId === item.id ? 0.5 : 1,
                              }}
                              draggable
                              onClick={(event) => handleChipClick(event, item.id)}
                              onDoubleClick={(event) => handleChipDoubleClick(event, item.id)}
                              onDragStart={(event) => handleDragStart(event, item)}
                              onDragEnd={handleDragEnd}
                            >
                              <p className="font-semibold">
                                {formatJstTime(item.startTime)}-{formatJstTime(item.endTime)}
                              </p>
                              <p>{item.petName}</p>
                              <p className="text-blue-700">{item.staffName}</p>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500">
        時刻表示は JST です。予約を押すと編集画面へ移動します。
      </p>
    </div>
  )
}
