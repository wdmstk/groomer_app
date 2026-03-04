import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  buildAppointmentMetricMeta,
  isAppointmentMetricEventType,
  normalizeAppointmentMetricMode,
  type AppointmentMetricRequestBody,
} from '@/lib/appointments/metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toNonNegativeNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export async function POST(request: Request) {
  const { storeId, supabase } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const body = (await request.json().catch(() => null)) as AppointmentMetricRequestBody | null
  const eventType = typeof body?.event_type === 'string' ? body.event_type.trim() : ''

  if (!isAppointmentMetricEventType(eventType)) {
    return NextResponse.json({ message: 'Unsupported appointment metric event_type.' }, { status: 400 })
  }

  const payload = {
    eventType,
    mode: normalizeAppointmentMetricMode(body?.mode),
    elapsedMs: toNonNegativeNumber(body?.elapsed_ms),
    clickCount: toNonNegativeNumber(body?.click_count),
    fieldChangeCount: toNonNegativeNumber(body?.field_change_count),
    selectedMenuCount: toNonNegativeNumber(body?.selected_menu_count),
    usedTemplateCopy: Boolean(body?.used_template_copy),
  }

  const insertPayload = {
    store_id: storeId,
    actor_user_id: user?.id ?? null,
    event_type: payload.eventType,
    mode: payload.mode,
    elapsed_ms: payload.elapsedMs,
    click_count: payload.clickCount,
    field_change_count: payload.fieldChangeCount,
    selected_menu_count: payload.selectedMenuCount,
    used_template_copy: payload.usedTemplateCopy,
    meta: buildAppointmentMetricMeta(payload.eventType, body),
  }

  const { error } = await supabase.from('appointment_metrics').insert(insertPayload)
  if (error) {
    console.warn(
      '[appointments.metrics.insert_failed]',
      JSON.stringify({
        storeId,
        message: error.message,
      })
    )
  }

  return NextResponse.json({ ok: true })
}
