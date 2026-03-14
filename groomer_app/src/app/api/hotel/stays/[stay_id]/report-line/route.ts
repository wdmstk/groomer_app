import { NextResponse } from 'next/server'
import { sendLineMessage } from '@/lib/line'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { requireStoreFeatureAccess } from '@/lib/feature-access'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { asObjectOrNull } from '@/lib/object-utils'
import {
  getDefaultHotelStayReportLineTemplate,
  renderHotelStayReportLineTemplate,
} from '@/lib/notification-templates'
import {
  buildHotelStayReportDedupeKey,
} from '@/lib/hotel/report-line'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireStoreContext() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }
  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membershipError || !membership) {
    return { ok: false as const, status: 403, message: membershipError?.message ?? 'Forbidden' }
  }
  const access = await requireStoreFeatureAccess({
    supabase,
    storeId,
    minimumPlan: 'standard',
    requiredOption: 'hotel',
  })
  if (!access.ok) {
    return { ok: false as const, status: 403, message: access.message }
  }
  if (!isHotelFeatureEnabledForStore(storeId)) {
    return { ok: false as const, status: 403, message: 'Hotel feature is not enabled for this store.' }
  }
  return { ok: true as const, supabase, storeId, user }
}

export async function POST(request: Request, context: { params: Promise<{ stay_id: string }> }) {
  const guard = await requireStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const payloadRaw: unknown = await request.json().catch(() => null)
  const payload = asObjectOrNull(payloadRaw)
  const reportBody = typeof payload?.report_body === 'string' ? payload.report_body.trim() : ''
  if (!reportBody) {
    return NextResponse.json({ message: 'report_body is required.' }, { status: 400 })
  }

  const { stay_id: stayId } = await context.params
  const { data: stay, error: stayError } = await guard.supabase
    .from('hotel_stays')
    .select('id, customer_id, pet_id, status, planned_check_in_at, planned_check_out_at')
    .eq('store_id', guard.storeId)
    .eq('id', stayId)
    .maybeSingle()
  if (stayError || !stay) {
    return NextResponse.json({ message: stayError?.message ?? 'Not found' }, { status: 404 })
  }

  const { data: pet, error: petError } = await guard.supabase
    .from('pets')
    .select('id, customer_id, name')
    .eq('store_id', guard.storeId)
    .eq('id', stay.pet_id as string)
    .maybeSingle()
  if (petError || !pet) {
    return NextResponse.json({ message: petError?.message ?? 'pet not found' }, { status: 400 })
  }

  const customerId = (stay.customer_id as string | null) ?? (pet.customer_id as string | null)
  if (!customerId) {
    return NextResponse.json({ message: 'customer_id is not resolved from stay.' }, { status: 400 })
  }

  const { data: customer, error: customerError } = await guard.supabase
    .from('customers')
    .select('id, full_name, line_id')
    .eq('store_id', guard.storeId)
    .eq('id', customerId)
    .maybeSingle()
  if (customerError || !customer) {
    return NextResponse.json({ message: customerError?.message ?? 'customer not found' }, { status: 400 })
  }
  if (!customer.line_id) {
    return NextResponse.json({ message: 'customer line_id is not registered.' }, { status: 400 })
  }

  const { data: templateRow } = await guard.supabase
    .from('notification_templates')
    .select('subject, body, is_active')
    .eq('store_id', guard.storeId)
    .eq('template_key', 'hotel_stay_report_line')
    .eq('channel', 'line')
    .maybeSingle()

  if (templateRow && templateRow.is_active === false) {
    return NextResponse.json({ message: 'hotel_stay_report_line template is disabled.' }, { status: 400 })
  }

  const subject = (templateRow?.subject?.trim() || '宿泊レポート') as string
  const renderedBody = renderHotelStayReportLineTemplate({
    customerName: (customer.full_name as string | null) ?? 'お客様',
    petName: (pet.name as string | null) ?? 'ペット',
    stayStatus: (stay.status as string) ?? 'reserved',
    plannedCheckInAt: String(stay.planned_check_in_at),
    plannedCheckOutAt: String(stay.planned_check_out_at),
    reportBody,
    templateBody: templateRow?.body?.trim() || getDefaultHotelStayReportLineTemplate(),
  })

  const dedupeKey = buildHotelStayReportDedupeKey({
    stayId,
    reportBody,
  })
  const { data: existing } = await guard.supabase
    .from('customer_notification_logs')
    .select('id')
    .eq('store_id', guard.storeId)
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ message: 'duplicated report send request.' }, { status: 409 })
  }

  const { data: reserved, error: reserveError } = await guard.supabase
    .from('customer_notification_logs')
    .insert({
      store_id: guard.storeId,
      customer_id: customerId,
      actor_user_id: guard.user.id,
      channel: 'line',
      notification_type: 'other',
      status: 'queued',
      subject,
      body: renderedBody,
      target: customer.line_id,
      dedupe_key: dedupeKey,
      payload: {
        kind: 'hotel_stay_report',
        stay_id: stayId,
        pet_id: pet.id,
        template_key: 'hotel_stay_report_line',
      },
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (reserveError || !reserved?.id) {
    return NextResponse.json({ message: reserveError?.message ?? 'failed to reserve log.' }, { status: 500 })
  }

  try {
    const sendResult = await sendLineMessage({
      to: customer.line_id,
      messages: [{ type: 'text', text: renderedBody }],
    })
    if (!sendResult.success) {
      throw new Error(sendResult.error ?? 'line_send_failed')
    }

    await guard.supabase
      .from('customer_notification_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', reserved.id)

    return NextResponse.json({ ok: true, log_id: reserved.id })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'line_send_failed'
    await guard.supabase
      .from('customer_notification_logs')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        payload: {
          kind: 'hotel_stay_report',
          stay_id: stayId,
          pet_id: pet.id,
          template_key: 'hotel_stay_report_line',
          reason,
        },
      })
      .eq('id', reserved.id)

    return NextResponse.json({ message: reason }, { status: 500 })
  }
}
