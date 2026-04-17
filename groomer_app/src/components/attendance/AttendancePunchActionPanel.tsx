'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'

type AttendanceEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

type AttendanceEventRow = {
  event_type: AttendanceEventType
  occurred_at: string
}

type Props = {
  staffId: string
  redirectTo: string
  businessDate: string
  locationRequired: boolean
  events: AttendanceEventRow[]
}

function formatTimeJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function summarize(events: AttendanceEventRow[]) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )
  let hasClockIn = false
  let hasClockOut = false
  let openBreak = false
  const lastByType: Partial<Record<AttendanceEventType, string>> = {}

  for (const event of sorted) {
    lastByType[event.event_type] = event.occurred_at
    if (event.event_type === 'clock_in') {
      hasClockIn = true
      continue
    }
    if (event.event_type === 'clock_out') {
      hasClockOut = true
      openBreak = false
      continue
    }
    if (event.event_type === 'break_start') {
      if (hasClockIn && !hasClockOut) openBreak = true
      continue
    }
    if (event.event_type === 'break_end') {
      if (hasClockIn && !hasClockOut) openBreak = false
    }
  }

  const enabled: Record<AttendanceEventType, boolean> = {
    clock_in: !hasClockIn && !hasClockOut,
    clock_out: hasClockIn && !hasClockOut && !openBreak,
    break_start: hasClockIn && !hasClockOut && !openBreak,
    break_end: hasClockIn && !hasClockOut && openBreak,
  }

  const nextRecommended: AttendanceEventType | null = enabled.clock_in
    ? 'clock_in'
    : enabled.break_end
      ? 'break_end'
      : enabled.clock_out
        ? 'clock_out'
        : null

  return {
    hasClockIn,
    hasClockOut,
    openBreak,
    enabled,
    nextRecommended,
    lastByType,
  }
}

export function AttendancePunchActionPanel({
  staffId,
  redirectTo,
  businessDate,
  locationRequired,
  events,
}: Props) {
  const [submitting, setSubmitting] = useState<AttendanceEventType | null>(null)
  const [coords, setCoords] = useState<{
    latitude: string
    longitude: string
    accuracy: number | null
    fetchedAt: string
  } | null>(null)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const summary = useMemo(() => summarize(events), [events])

  const requestLocation = () => {
    if (!locationRequired) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('この端末では位置情報を利用できません。')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          fetchedAt: new Date().toISOString(),
        })
        setGeoLoading(false)
      },
      (error) => {
        setGeoError(error.message || '位置情報の取得に失敗しました。')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const locationBlocked = locationRequired && !coords

  useEffect(() => {
    if (!locationRequired || coords || geoLoading) return
    requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationRequired])

  useEffect(() => {
    if (!coords) {
      setLocationLabel(null)
      return
    }
    let isCancelled = false
    const fetchLocationLabel = async () => {
      try {
        const query = new URLSearchParams({
          format: 'jsonv2',
          lat: coords.latitude,
          lon: coords.longitude,
          zoom: '16',
          'accept-language': 'ja',
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`)
        if (!response.ok) return
        const data = (await response.json()) as {
          address?: Record<string, string>
          display_name?: string
        }
        const address = data.address ?? {}
        const localName =
          address.suburb ??
          address.neighbourhood ??
          address.city_district ??
          address.city ??
          address.town ??
          address.village ??
          address.state ??
          ''
        const label = localName ? `${localName}付近` : data.display_name?.split(',')[0]?.trim() ?? null
        if (!isCancelled) setLocationLabel(label)
      } catch {
        if (!isCancelled) setLocationLabel(null)
      }
    }
    void fetchLocationLabel()
    return () => {
      isCancelled = true
    }
  }, [coords])

  const statusLabel = summary.hasClockOut
    ? '本日は退勤済みです。'
    : summary.openBreak
      ? '現在は休憩中です。'
      : summary.hasClockIn
        ? '勤務中です。'
        : '未出勤です。'

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 dark:text-slate-300">現在状態: {statusLabel}</p>
      {locationRequired ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p>位置情報必須: {coords ? '取得済み' : geoLoading ? '取得中...' : '未取得'}</p>
          {coords ? (
            <p className="mt-1 text-[11px] text-gray-600 dark:text-slate-300">
              取得位置: {locationLabel ?? `緯度 ${Number(coords.latitude).toFixed(5)} / 経度 ${Number(coords.longitude).toFixed(5)}`}
              {coords.accuracy !== null ? `（精度±${Math.round(coords.accuracy)}m）` : ''} {formatTimeJst(coords.fetchedAt)}
            </p>
          ) : null}
          {geoError ? <p className="mt-1 text-red-700 dark:text-red-300">{geoError}</p> : null}
          <button
            type="button"
            onClick={requestLocation}
            className="mt-2 inline-flex h-7 items-center rounded border border-blue-600 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
          >
            位置情報を取得
          </button>
        </div>
      ) : null}

      <div className="flex max-w-xs flex-col gap-2">
        {(['clock_in', 'clock_out', 'break_start', 'break_end'] as const).map((eventType) => {
          const enabled = summary.enabled[eventType] && !locationBlocked && submitting === null
          const recommended = summary.nextRecommended === eventType
          const lastTime = formatTimeJst(summary.lastByType[eventType])
          return (
            <form
              key={eventType}
              action="/api/attendance/events"
              method="post"
              onSubmit={() => setSubmitting(eventType)}
            >
              <input type="hidden" name="event_type" value={eventType} />
              <input type="hidden" name="staff_id" value={staffId} />
              <input type="hidden" name="business_date" value={businessDate} />
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <input type="hidden" name="location_lat" value={coords?.latitude ?? ''} />
              <input type="hidden" name="location_lng" value={coords?.longitude ?? ''} />
              <input type="hidden" name="location_accuracy_meters" value={coords?.accuracy ?? ''} />
              <input type="hidden" name="location_captured_at" value={coords?.fetchedAt ?? ''} />
              <Button
                type="submit"
                disabled={!enabled}
                className={`w-full border border-indigo-700 bg-indigo-600 text-left text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${
                  recommended ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''
                }`}
              >
                <span className="block text-sm font-semibold">
                  {eventType === 'clock_in'
                    ? '出勤打刻'
                    : eventType === 'clock_out'
                      ? '退勤打刻'
                      : eventType === 'break_start'
                        ? '休憩開始'
                        : '休憩終了'}
                </span>
                <span className="block text-[11px] text-indigo-100">最終打刻: {lastTime}</span>
              </Button>
            </form>
          )
        })}
      </div>
    </div>
  )
}
