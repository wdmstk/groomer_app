import { NextResponse } from 'next/server'
import { requireStoreMembership } from '@/lib/auth/store-membership'
import { resolveAttendanceFeatureState } from '@/lib/attendance/feature'
import { asObject, type UnknownObject } from '@/lib/object-utils'
import { recomputeAttendanceDailySummary } from '@/lib/staff-shifts/attendance'
import { resolveSafeRedirectTo } from '@/lib/staff-shifts/shared'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { isAttendanceMonthClosed, monthKeyFromDateKey } from '@/lib/attendance/monthly-closing'

type AttendanceEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
const DUPLICATE_EVENT_WINDOW_SECONDS = 5

function toDateKeyJst(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function parseEventType(value: string): AttendanceEventType | null {
  if (value === 'clock_in' || value === 'clock_out' || value === 'break_start' || value === 'break_end') {
    return value
  }
  return null
}

function isMissingRelationErrorMessage(message: string | null | undefined, relationName: string) {
  return `${message ?? ''}`.includes(relationName)
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

function parseOptionalIsoDatetime(value: unknown) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const ts = new Date(text)
  if (!Number.isFinite(ts.getTime())) return null
  return ts.toISOString()
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000
  const latDiff = toRadians(lat2 - lat1)
  const lngDiff = toRadians(lng2 - lng1)
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

async function insertBlockedLog(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  storeId: string
  attemptedByUserId: string
  targetStaffId: string | null
  eventType: AttendanceEventType | null
  businessDate: string | null
  occurredAt: string | null
  reason: string
  metadata?: { [key: string]: unknown }
}) {
  try {
    const result = await params.db.from('attendance_punch_block_logs').insert({
      store_id: params.storeId,
      attempted_by_user_id: params.attemptedByUserId,
      target_staff_id: params.targetStaffId,
      event_type: params.eventType,
      business_date: params.businessDate,
      occurred_at: params.occurredAt,
      reason: params.reason,
      metadata: params.metadata ?? {},
    })
    if (result.error && !isMissingRelationErrorMessage(result.error.message, 'attendance_punch_block_logs')) {
      throw new Error(result.error.message)
    }
  } catch {
    // no-op: logging failure should not block response
  }
}

export async function POST(request: Request) {
  const auth = await requireStoreMembership(['owner', 'admin', 'staff'])
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })
  const featureState = await resolveAttendanceFeatureState({ db: auth.supabase, storeId: auth.storeId })
  if (featureState.message) return NextResponse.json({ message: featureState.message }, { status: 500 })
  if (!featureState.enabled) return NextResponse.json({ message: '勤怠機能は無効です。' }, { status: 403 })

  const contentType = request.headers.get('content-type') ?? ''
  let body: UnknownObject = {}
  let redirectTo: string | null = null
  if (contentType.includes('application/json')) {
    const bodyRaw: unknown = await request.json()
    body = asObject(bodyRaw)
  } else {
    const formData = await request.formData()
    body = {
      event_type: formData.get('event_type')?.toString() ?? '',
      occurred_at: formData.get('occurred_at')?.toString() ?? '',
      business_date: formData.get('business_date')?.toString() ?? '',
      staff_id: formData.get('staff_id')?.toString() ?? '',
      location_lat: (formData.get('location_lat') ?? formData.get('latitude'))?.toString() ?? '',
      location_lng: (formData.get('location_lng') ?? formData.get('longitude'))?.toString() ?? '',
      location_accuracy_meters: formData.get('location_accuracy_meters')?.toString() ?? '',
      location_captured_at: formData.get('location_captured_at')?.toString() ?? '',
    }
    redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  }

  const eventType = parseEventType(String(body.event_type ?? ''))
  if (!eventType) {
    return NextResponse.json({ message: 'event_type が不正です。' }, { status: 400 })
  }

  const occurredAtRaw = String(body.occurred_at ?? '').trim()
  const occurredAt = occurredAtRaw || new Date().toISOString()
  if (!Number.isFinite(new Date(occurredAt).getTime())) {
    return NextResponse.json({ message: 'occurred_at が不正です。' }, { status: 400 })
  }
  const businessDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.business_date ?? ''))
    ? String(body.business_date)
    : toDateKeyJst(occurredAt)
  const monthKey = monthKeyFromDateKey(businessDate)
  const monthClosing = await isAttendanceMonthClosed({ db: auth.supabase, storeId: auth.storeId, targetMonth: monthKey })
  if (monthClosing.message) return NextResponse.json({ message: monthClosing.message }, { status: 500 })
  if (monthClosing.closed) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId: String(body.staff_id ?? '').trim() || null,
      eventType,
      businessDate,
      occurredAt,
      reason: 'month_closed',
    })
    return NextResponse.json({ message: '対象月は勤怠確定済みのため、打刻を変更できません。' }, { status: 409 })
  }

  let locationRequired = false
  let storeLocationLat: number | null = null
  let storeLocationLng: number | null = null
  let storeLocationRadiusMeters: number | null = null
  try {
    const settingResult = await auth.supabase
      .from('store_shift_settings')
      .select('attendance_location_required, attendance_location_lat, attendance_location_lng, attendance_location_radius_meters')
      .eq('store_id', auth.storeId)
      .maybeSingle()
    if (settingResult.error && !isMissingRelationErrorMessage(settingResult.error.message, 'store_shift_settings')) {
      return NextResponse.json({ message: settingResult.error.message }, { status: 500 })
    }
    locationRequired = settingResult.data?.attendance_location_required === true
    const latCandidate = Number(settingResult.data?.attendance_location_lat ?? Number.NaN)
    const lngCandidate = Number(settingResult.data?.attendance_location_lng ?? Number.NaN)
    const radiusCandidate = Number(settingResult.data?.attendance_location_radius_meters ?? Number.NaN)
    storeLocationLat = Number.isFinite(latCandidate) ? latCandidate : null
    storeLocationLng = Number.isFinite(lngCandidate) ? lngCandidate : null
    storeLocationRadiusMeters = Number.isFinite(radiusCandidate) ? radiusCandidate : null
  } catch {
    locationRequired = false
  }
  const latitudeRaw = String((body.location_lat ?? body.latitude ?? '') as string).trim()
  const longitudeRaw = String((body.location_lng ?? body.longitude ?? '') as string).trim()
  const accuracyRaw = String((body.location_accuracy_meters ?? '') as string).trim()
  const capturedAtRaw = String((body.location_captured_at ?? '') as string).trim()
  const latitude = parseOptionalNumber(latitudeRaw)
  const longitude = parseOptionalNumber(longitudeRaw)
  const accuracyMeters = parseOptionalNumber(accuracyRaw)
  const capturedAt = parseOptionalIsoDatetime(capturedAtRaw)
  const hasValidLocation =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  if (locationRequired && !hasValidLocation) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId: String(body.staff_id ?? '').trim() || null,
      eventType,
      businessDate,
      occurredAt,
      reason: 'location_required',
      metadata: { latitude: latitudeRaw, longitude: longitudeRaw },
    })
    return NextResponse.json({ message: 'この店舗では位置情報付き打刻が必須です。' }, { status: 422 })
  }
  if (
    locationRequired &&
    (storeLocationLat === null ||
      storeLocationLng === null ||
      storeLocationRadiusMeters === null ||
      storeLocationRadiusMeters <= 0)
  ) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId: String(body.staff_id ?? '').trim() || null,
      eventType,
      businessDate,
      occurredAt,
      reason: 'location_store_settings_missing',
    })
    return NextResponse.json({ message: '店舗の位置情報基準（緯度・経度・半径）が未設定です。' }, { status: 422 })
  }

  const requestedStaffId = String(body.staff_id ?? '').trim()
  const { data: ownStaff } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  const ownStaffId = ownStaff?.id ?? null
  const targetStaffId = requestedStaffId || ownStaffId
  if (!targetStaffId) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId: null,
      eventType,
      businessDate,
      occurredAt,
      reason: 'staff_not_resolved',
    })
    return NextResponse.json({ message: 'staff_id を指定してください。' }, { status: 400 })
  }

  if (auth.role === 'staff' && targetStaffId !== ownStaffId) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId,
      eventType,
      businessDate,
      occurredAt,
      reason: 'forbidden_other_staff',
    })
    return NextResponse.json({ message: '他スタッフの打刻はできません。' }, { status: 403 })
  }

  const { data: staffCheck } = await auth.supabase
    .from('staffs')
    .select('id')
    .eq('store_id', auth.storeId)
    .eq('id', targetStaffId)
    .maybeSingle()
  if (!staffCheck) return NextResponse.json({ message: 'スタッフが見つかりません。' }, { status: 404 })

  const distanceMeters =
    hasValidLocation && storeLocationLat !== null && storeLocationLng !== null
      ? calcDistanceMeters(latitude, longitude, storeLocationLat, storeLocationLng)
      : null
  const locationWithinRadius =
    distanceMeters !== null && storeLocationRadiusMeters !== null ? distanceMeters <= storeLocationRadiusMeters : null
  if (locationRequired && locationWithinRadius !== true) {
    await insertBlockedLog({
      db: auth.supabase,
      storeId: auth.storeId,
      attemptedByUserId: auth.user.id,
      targetStaffId,
      eventType,
      businessDate,
      occurredAt,
      reason: 'location_out_of_radius',
      metadata: {
        distance_meters: distanceMeters,
        allowed_radius_meters: storeLocationRadiusMeters,
      },
    })
    return NextResponse.json({ message: '店舗の許容半径外のため打刻できません。' }, { status: 403 })
  }

  const duplicateQuery = await auth.supabase
    .from('attendance_events')
    .select('occurred_at')
    .eq('store_id', auth.storeId)
    .eq('staff_id', targetStaffId)
    .eq('business_date', businessDate)
    .eq('event_type', eventType)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (duplicateQuery.error) return NextResponse.json({ message: duplicateQuery.error.message }, { status: 500 })
  const lastEventTime = duplicateQuery.data?.occurred_at ? new Date(duplicateQuery.data.occurred_at).getTime() : Number.NaN
  const currentEventTime = new Date(occurredAt).getTime()
  if (
    Number.isFinite(lastEventTime) &&
    Number.isFinite(currentEventTime) &&
    Math.abs(currentEventTime - lastEventTime) < DUPLICATE_EVENT_WINDOW_SECONDS * 1000
  ) {
    return NextResponse.json({ message: '同一打刻の短時間重複はできません。' }, { status: 409 })
  }

  const { error: insertError } = await auth.supabase.from('attendance_events').insert({
    store_id: auth.storeId,
    staff_id: targetStaffId,
    business_date: businessDate,
    event_type: eventType,
    occurred_at: occurredAt,
    location_lat: hasValidLocation ? latitude : null,
    location_lng: hasValidLocation ? longitude : null,
    location_accuracy_meters: accuracyMeters,
    location_captured_at: capturedAt,
    location_is_within_radius: locationWithinRadius,
    source_type: 'self',
  })
  if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 })

  let summary: Awaited<ReturnType<typeof recomputeAttendanceDailySummary>>
  try {
    summary = await recomputeAttendanceDailySummary({
      db: auth.supabase,
      storeId: auth.storeId,
      staffId: targetStaffId,
      businessDate,
    })
  } catch (summaryError) {
    try {
      const summaryDb = createAdminSupabaseClient()
      summary = await recomputeAttendanceDailySummary({
        db: summaryDb,
        storeId: auth.storeId,
        staffId: targetStaffId,
        businessDate,
      })
    } catch (adminSummaryError) {
      const fallbackMessage =
        adminSummaryError instanceof Error
          ? adminSummaryError.message
          : summaryError instanceof Error
            ? summaryError.message
            : '勤務集計の更新に失敗しました。'
      return NextResponse.json({ message: fallbackMessage }, { status: 500 })
    }
  }

  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, request.url))
  return NextResponse.json({ ok: true, data: { business_date: businessDate, summary } }, { status: 201 })
}
