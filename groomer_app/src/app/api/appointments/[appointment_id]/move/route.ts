import { NextResponse } from 'next/server'
import { insertAuditLogBestEffort } from '@/lib/audit-logs'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { validateAppointmentConflict } from '@/lib/appointments/conflict'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

function toIsoString(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

type DelayImpactItem = {
  appointmentId: string
  startTime: string | null
  endTime: string | null
  customerName: string
  petName: string
  overlapMin: number
}

type DelayImpactScenario = {
  offsetMin: number
  impactedCount: number
  impacts: DelayImpactItem[]
}

async function buildDelayImpactAlert(params: {
  supabase: Awaited<ReturnType<typeof createStoreScopedClient>>['supabase']
  storeId: string
  staffId: string
  appointmentId: string
  baseEndTimeIso: string
}) {
  const baseEndAt = new Date(params.baseEndTimeIso)
  if (Number.isNaN(baseEndAt.getTime())) {
    return null
  }

  const dayStart = new Date(baseEndAt)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const { data, error } = await params.supabase
    .from('appointments')
    .select('id, customer_id, pet_id, start_time, end_time')
    .eq('store_id', params.storeId)
    .eq('staff_id', params.staffId)
    .gte('start_time', dayStart.toISOString())
    .lt('start_time', dayEnd.toISOString())
    .gt('start_time', params.baseEndTimeIso)
    .neq('id', params.appointmentId)
    .order('start_time', { ascending: true })
    .limit(20)

  if (error) {
    return null
  }

  const candidates = data ?? []
  const customerIds = Array.from(new Set(candidates.map((row) => row.customer_id).filter(Boolean)))
  const petIds = Array.from(new Set(candidates.map((row) => row.pet_id).filter(Boolean)))

  const [{ data: customerRows }, { data: petRows }] = await Promise.all([
    customerIds.length > 0
      ? params.supabase
          .from('customers')
          .select('id, full_name')
          .eq('store_id', params.storeId)
          .in('id', customerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    petIds.length > 0
      ? params.supabase
          .from('pets')
          .select('id, name')
          .eq('store_id', params.storeId)
          .in('id', petIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const customerNameMap = new Map<string, string>(
    (customerRows ?? []).map((row) => [row.id, row.full_name ?? '未登録'])
  )
  const petNameMap = new Map<string, string>((petRows ?? []).map((row) => [row.id, row.name ?? '未登録']))

  const offsets = [10, 20]
  const scenarios: DelayImpactScenario[] = offsets.map((offsetMin) => {
    const delayedEndAt = new Date(baseEndAt.getTime() + offsetMin * 60 * 1000)
    const impacts = candidates
      .filter((row) => {
        const startAt = new Date(row.start_time ?? '')
        return !Number.isNaN(startAt.getTime()) && startAt.getTime() < delayedEndAt.getTime()
      })
      .map((row) => {
        const startAt = new Date(row.start_time ?? '')
        const overlapMin = Math.max(
          1,
          Math.ceil((delayedEndAt.getTime() - startAt.getTime()) / (60 * 1000))
        )
        const customer = row.customer_id ? customerNameMap.get(row.customer_id) : null
        const pet = row.pet_id ? petNameMap.get(row.pet_id) : null
        return {
          appointmentId: row.id,
          startTime: row.start_time ?? null,
          endTime: row.end_time ?? null,
          customerName: customer ?? '未登録',
          petName: pet ?? '未登録',
          overlapMin,
        }
      })

    return {
      offsetMin,
      impactedCount: impacts.length,
      impacts,
    }
  })

  if (scenarios.every((scenario) => scenario.impactedCount === 0)) {
    return null
  }

  return {
    baseEndTime: params.baseEndTimeIso,
    scenarios,
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const startedAtMs = Date.now()
  const { appointment_id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        start_time?: string
        end_time?: string
        staff_id?: string
      }
    | null

  const startTimeIso = toIsoString(body?.start_time)
  const endTimeIso = toIsoString(body?.end_time)
  const staffId = typeof body?.staff_id === 'string' ? body.staff_id : ''

  if (!startTimeIso || !endTimeIso || !staffId) {
    return NextResponse.json(
      { message: '開始/終了日時またはスタッフが不正です。', processing_ms: Date.now() - startedAtMs },
      { status: 400 }
    )
  }

  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: target, error: targetError } = await supabase
    .from('appointments')
    .select('id, customer_id, pet_id, staff_id, start_time, end_time, status, notes')
    .eq('id', appointment_id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (targetError || !target) {
    return NextResponse.json(
      { message: '対象予約が見つかりません。', processing_ms: Date.now() - startedAtMs },
      { status: 404 }
    )
  }

  const { data: staffCheck } = await supabase
    .from('staffs')
    .select('id')
    .eq('id', staffId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!staffCheck) {
    return NextResponse.json(
      { message: 'スタッフが見つかりません。', processing_ms: Date.now() - startedAtMs },
      { status: 400 }
    )
  }

  const conflictCheck = await validateAppointmentConflict({
    supabase,
    storeId,
    staffId,
    startTimeIso,
    endTimeIso,
    excludeAppointmentId: appointment_id,
  })
  if (!conflictCheck.ok) {
    return NextResponse.json(
      {
        message: conflictCheck.message,
        conflict: conflictCheck.conflict ?? null,
        processing_ms: Date.now() - startedAtMs,
      },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      staff_id: staffId,
      start_time: startTimeIso,
      end_time: endTimeIso,
    })
    .eq('id', appointment_id)
    .eq('store_id', storeId)

  if (error) {
    return NextResponse.json(
      { message: error.message, processing_ms: Date.now() - startedAtMs },
      { status: 500 }
    )
  }

  await insertAuditLogBestEffort({
    supabase,
    storeId,
    actorUserId: user?.id ?? null,
    entityType: 'appointment',
    entityId: appointment_id,
    action: 'moved',
    before: target,
    after: {
      ...target,
      staff_id: staffId,
      start_time: startTimeIso,
      end_time: endTimeIso,
    },
    payload: {
      previous_staff_id: target.staff_id,
      next_staff_id: staffId,
      previous_start_time: target.start_time,
      next_start_time: startTimeIso,
      previous_end_time: target.end_time,
      next_end_time: endTimeIso,
    },
  })

  const delayAlert = await buildDelayImpactAlert({
    supabase,
    storeId,
    staffId,
    appointmentId: appointment_id,
    baseEndTimeIso: endTimeIso,
  })

  return NextResponse.json({
    ok: true,
    processing_ms: Date.now() - startedAtMs,
    delay_alert: delayAlert,
  })
}
