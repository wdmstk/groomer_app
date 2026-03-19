import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { PublicReservationServiceError } from '@/lib/public-reservations/services/shared'
import {
  buildSlotCandidates,
  getPublicReserveSlotConfig,
  mergePublicReserveSlotConfig,
} from '@/lib/public-reservations/services/slot-candidates'

type RouteParams = {
  params: Promise<{
    store_id: string
  }>
}

async function fetchActiveStore(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id, is_active')
    .eq('id', storeId)
    .single()

  if (storeError || !store || !store.is_active) {
    throw new PublicReservationServiceError('店舗が見つかりません。', 404)
  }
}

async function fetchStaffIds(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
  const { data: staffs } = await admin
    .from('staffs')
    .select('id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })
  return (staffs ?? []).map((staff) => staff.id).filter(Boolean)
}

type OccupiedAppointmentRow = {
  staff_id: string | null
  start_time: string | null
  end_time: string | null
}

type SlotWithStaff = {
  start_time: string
  end_time: string
  staff_id: string
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getDateKeyJst(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export async function GET(request: Request, { params }: RouteParams) {
  const { store_id: storeId } = await params
  const requestUrl = new URL(request.url)
  const menuIds = (requestUrl.searchParams.get('menu_ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const targetDate = (requestUrl.searchParams.get('target_date') ?? '').trim()
  if (menuIds.length === 0) {
    return NextResponse.json({ slots: [], message: 'メニューを選択してください。' })
  }
  if (targetDate && !isDateKey(targetDate)) {
    return NextResponse.json({ slots: [], message: '候補日の形式が不正です。' }, { status: 400 })
  }

  try {
    const admin = createAdminSupabaseClient()
    await fetchActiveStore(admin, storeId)
    const baseConfig = getPublicReserveSlotConfig()
    const { data: storeRule } = await admin
      .from('stores')
      .select(
        'public_reserve_slot_days, public_reserve_slot_interval_minutes, public_reserve_slot_buffer_minutes, public_reserve_business_start_hour_jst, public_reserve_business_end_hour_jst, public_reserve_min_lead_minutes'
      )
      .eq('id', storeId)
      .maybeSingle()
    const config = mergePublicReserveSlotConfig(baseConfig, {
      days: Number(storeRule?.public_reserve_slot_days ?? baseConfig.days),
      intervalMinutes: Number(
        storeRule?.public_reserve_slot_interval_minutes ?? baseConfig.intervalMinutes
      ),
      bufferMinutes: Number(storeRule?.public_reserve_slot_buffer_minutes ?? baseConfig.bufferMinutes),
      businessStartHour: Number(
        storeRule?.public_reserve_business_start_hour_jst ?? baseConfig.businessStartHour
      ),
      businessEndHour: Number(
        storeRule?.public_reserve_business_end_hour_jst ?? baseConfig.businessEndHour
      ),
      minLeadMinutes: Number(storeRule?.public_reserve_min_lead_minutes ?? baseConfig.minLeadMinutes),
    })
    const { data: selectedMenus, error: menuError } = await admin
      .from('service_menus')
      .select('id, duration, is_instant_bookable')
      .in('id', menuIds)
      .eq('store_id', storeId)
      .eq('is_active', true)
    if (menuError) {
      throw new PublicReservationServiceError(menuError.message, 500)
    }

    if (!selectedMenus || selectedMenus.length !== menuIds.length) {
      return NextResponse.json({ slots: [], message: '選択メニューが無効です。' }, { status: 400 })
    }

    const instantMenuIds = selectedMenus
      .filter((menu) => Boolean(menu.is_instant_bookable))
      .map((menu) => menu.id)
    const isInstant = selectedMenus.every((menu) => Boolean(menu.is_instant_bookable))
    if (!isInstant) {
      return NextResponse.json({
        slots: [],
        instant_menu_ids: instantMenuIds,
        message: 'このメニュー組み合わせは空き枠提示の対象外です。希望日時で申請してください。',
      })
    }

    const totalDurationMinutes = selectedMenus.reduce((sum, menu) => sum + Math.max(1, menu.duration ?? 0), 0)
    const staffIds = await fetchStaffIds(admin, storeId)
    if (staffIds.length === 0) {
      return NextResponse.json({ slots: [], message: '担当スタッフ未設定のため空き枠を表示できません。' })
    }

    const now = new Date()
    const rangeStartIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const rangeEndIso = new Date(now.getTime() + config.days * 24 * 60 * 60 * 1000).toISOString()
    const blockedDateRangeStart = now.toISOString().slice(0, 10)
    const blockedDateRangeEnd = rangeEndIso.slice(0, 10)
    const { data: occupiedRows, error: occupiedError } = await admin
      .from('appointments')
      .select('staff_id, start_time, end_time')
      .eq('store_id', storeId)
      .in('staff_id', staffIds)
      .not('status', 'in', '("キャンセル","無断キャンセル")')
      .lt('start_time', rangeEndIso)
      .gt('end_time', rangeStartIso)

    if (occupiedError) {
      throw new PublicReservationServiceError(occupiedError.message, 500)
    }
    const { data: blockedDateRows, error: blockedDateError } = await admin
      .from('store_public_reserve_blocked_dates')
      .select('date_key')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .gte('date_key', blockedDateRangeStart)
      .lte('date_key', blockedDateRangeEnd)
    if (blockedDateError) {
      throw new PublicReservationServiceError(blockedDateError.message, 500)
    }
    const blockedDateKeysJst = (blockedDateRows ?? [])
      .map((row) => row.date_key)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    const occupiedByStaffId = new Map<string, Array<{ start_time: string | null; end_time: string | null }>>()
    ;((occupiedRows ?? []) as OccupiedAppointmentRow[]).forEach((row) => {
      if (!row.staff_id) return
      const rows = occupiedByStaffId.get(row.staff_id) ?? []
      rows.push({ start_time: row.start_time, end_time: row.end_time })
      occupiedByStaffId.set(row.staff_id, rows)
    })
    const staffPriorityById = new Map<string, number>()
    staffIds.forEach((id, index) => {
      staffPriorityById.set(id, index)
    })
    const occupiedCountByStaffId = new Map<string, number>()
    staffIds.forEach((id) => {
      occupiedCountByStaffId.set(id, (occupiedByStaffId.get(id) ?? []).length)
    })

    const slotByStart = new Map<string, SlotWithStaff>()
    const slotConfigForBuild = targetDate ? { ...config, maxSlots: 1000 } : config
    for (const staffId of staffIds) {
      const staffSlots = buildSlotCandidates({
        now,
        occupiedAppointments: occupiedByStaffId.get(staffId) ?? [],
        serviceDurationMinutes: totalDurationMinutes,
        config: slotConfigForBuild,
        blockedDateKeysJst,
      })
      const filteredStaffSlots = targetDate
        ? staffSlots.filter((slot) => getDateKeyJst(slot.start_time) === targetDate)
        : staffSlots
      for (const slot of filteredStaffSlots) {
        const nextSlot = {
          ...slot,
          staff_id: staffId,
        }
        const current = slotByStart.get(slot.start_time)
        if (!current) {
          slotByStart.set(slot.start_time, nextSlot)
          continue
        }

        const currentOccupiedCount = occupiedCountByStaffId.get(current.staff_id) ?? Number.MAX_SAFE_INTEGER
        const nextOccupiedCount = occupiedCountByStaffId.get(staffId) ?? Number.MAX_SAFE_INTEGER
        if (nextOccupiedCount < currentOccupiedCount) {
          slotByStart.set(slot.start_time, nextSlot)
          continue
        }
        if (nextOccupiedCount > currentOccupiedCount) continue

        const currentPriority = staffPriorityById.get(current.staff_id) ?? Number.MAX_SAFE_INTEGER
        const nextPriority = staffPriorityById.get(staffId) ?? Number.MAX_SAFE_INTEGER
        if (nextPriority < currentPriority) {
          slotByStart.set(slot.start_time, nextSlot)
        }
      }
    }

    const slots = [...slotByStart.values()]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, config.maxSlots)

    return NextResponse.json({
      slots,
      instant_menu_ids: instantMenuIds,
      config,
      message:
        slots.length > 0
          ? '表示枠は即時確定候補です。最終確定時に再検証されます。'
          : targetDate
            ? '選択日の空き枠がありません。候補日を変更してください。'
            : '表示可能な空き枠がありません。希望日時で申請してください。',
    })
  } catch (error) {
    if (error instanceof PublicReservationServiceError) {
      return NextResponse.json({ message: error.message, slots: [] }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message, slots: [] }, { status: 500 })
  }
}
