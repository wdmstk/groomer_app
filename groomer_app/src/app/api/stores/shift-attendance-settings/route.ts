import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { parseBoolean, parseDateKeyList, parseWeekdayList, resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'

function toAnyClient(supabase: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any
}

function parseBooleanFromFormData(formData: FormData, key: string) {
  const values = formData.getAll(key)
  if (values.length === 0) return false
  return values.some((value) => parseBoolean(value))
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

export async function POST(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)

  const attendancePunchEnabled = parseBooleanFromFormData(formData, 'attendance_punch_enabled')
  const attendanceLocationRequired = parseBooleanFromFormData(formData, 'attendance_location_required')
  const attendanceLocationLat = parseOptionalNumber(formData.get('attendance_location_lat'))
  const attendanceLocationLng = parseOptionalNumber(formData.get('attendance_location_lng'))
  const attendanceLocationRadiusRaw = parseOptionalNumber(formData.get('attendance_location_radius_meters'))
  const attendanceLocationRadiusMeters =
    attendanceLocationRadiusRaw === null ? 200 : Math.max(1, Math.min(5000, Math.trunc(attendanceLocationRadiusRaw)))
  const shouldUpdateAttendance =
    formData.has('attendance_punch_enabled') ||
    formData.has('attendance_location_required') ||
    formData.has('attendance_location_lat') ||
    formData.has('attendance_location_lng') ||
    formData.has('attendance_location_radius_meters')
  const shouldUpdateClosedRules = formData.has('closed_weekdays') || formData.has('closed_dates_text')
  const closedWeekdays = shouldUpdateClosedRules
    ? parseWeekdayList(
        formData
          .getAll('closed_weekdays')
          .map((value) => value.toString())
          .join(',')
      )
    : []
  const closedDates = shouldUpdateClosedRules
    ? parseDateKeyList(formData.get('closed_dates_text')?.toString() ?? '')
    : []

  const db = toAnyClient(auth.supabase)
  const nowIso = new Date().toISOString()

  if (shouldUpdateAttendance) {
    if (
      attendanceLocationRequired &&
      (attendanceLocationLat === null ||
        attendanceLocationLng === null ||
        attendanceLocationLat < -90 ||
        attendanceLocationLat > 90 ||
        attendanceLocationLng < -180 ||
        attendanceLocationLng > 180)
    ) {
      return NextResponse.json(
        { message: '位置情報必須を有効にする場合は、基準緯度・基準経度を正しく設定してください。' },
        { status: 422 }
      )
    }
    const { error: settingsError } = await db.from('store_shift_settings').upsert(
      {
        store_id: auth.storeId,
        attendance_punch_enabled: attendancePunchEnabled,
        attendance_location_required: attendanceLocationRequired,
        attendance_location_lat: attendanceLocationLat,
        attendance_location_lng: attendanceLocationLng,
        attendance_location_radius_meters: attendanceLocationRadiusMeters,
        updated_at: nowIso,
      },
      { onConflict: 'store_id' }
    )
    if (settingsError) return NextResponse.json({ message: settingsError.message }, { status: 500 })
  }

  if (shouldUpdateClosedRules) {
    const { error: deleteClosedError } = await db.from('store_closed_rules').delete().eq('store_id', auth.storeId)
    if (deleteClosedError) return NextResponse.json({ message: deleteClosedError.message }, { status: 500 })

    const closedRows = [
      ...closedWeekdays.map((weekday) => ({
        store_id: auth.storeId,
        rule_type: 'weekday',
        weekday,
        closed_date: null,
        note: 'store_ops_settings',
        is_active: true,
      })),
      ...closedDates.map((closedDate) => ({
        store_id: auth.storeId,
        rule_type: 'date',
        weekday: null,
        closed_date: closedDate,
        note: 'store_ops_settings',
        is_active: true,
      })),
    ]

    if (closedRows.length > 0) {
      const { error: insertClosedError } = await db.from('store_closed_rules').insert(closedRows)
      if (insertClosedError) return NextResponse.json({ message: insertClosedError.message }, { status: 500 })
    }

    const { error: deletePublicBlockedError } = await db
      .from('store_public_reserve_blocked_dates')
      .delete()
      .eq('store_id', auth.storeId)
    if (deletePublicBlockedError) {
      return NextResponse.json({ message: deletePublicBlockedError.message }, { status: 500 })
    }

    if (closedDates.length > 0) {
      const publicBlockedRows = closedDates.map((dateKey) => ({
        store_id: auth.storeId,
        date_key: dateKey,
        is_active: true,
        reason: 'store_ops_settings',
      }))
      const { error: insertPublicBlockedError } = await db
        .from('store_public_reserve_blocked_dates')
        .insert(publicBlockedRows)
      if (insertPublicBlockedError) {
        return NextResponse.json({ message: insertPublicBlockedError.message }, { status: 500 })
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return NextResponse.json({ ok: true })
}
