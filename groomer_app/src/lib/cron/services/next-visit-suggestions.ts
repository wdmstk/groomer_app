import { sendLineMessage } from '@/lib/line'
import { renderNextVisitSuggestionLineTemplate } from '@/lib/notification-templates'
import { addDays, getRecommendedVisitIntervalDays, getRecommendationReason } from '@/lib/followups/recommendation'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getJstDate, getJstNowParts, addDaysToJstDate } from './appointment-reminders-core'

type VisitRow = {
  customer_id: string | null
  visit_date: string
  appointment_id: string | null
  store_id: string
}

type AppointmentRow = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string | null
  status: string | null
}

type PetRow = {
  id: string
  breed: string | null
  coat_volume: string | null
  name: string
}

type CustomerRow = {
  id: string
  full_name: string
  line_id: string | null
}

type StoreSettingsRow = {
  store_id: string
  next_visit_line_enabled: boolean | null
  next_visit_notice_days_before: number | null
}

type TemplateRow = {
  store_id: string
  body: string
}

function makeDedupeKey(params: {
  customerId: string
  petId: string | null
  recommendedDateJst: string
}) {
  return `next_visit_suggestion:line:${params.customerId}:${params.petId ?? 'none'}:${params.recommendedDateJst}`
}

export async function runNextVisitSuggestionsJob() {
  const admin = createAdminSupabaseClient()
  const { todayJst } = getJstNowParts()
  const lookbackStartIso = addDays(`${todayJst}T00:00:00+09:00`, -120)?.toISOString() ?? new Date(0).toISOString()

  const [{ data: visits }, { data: appointments }, { data: customers }, { data: pets }, { data: settingsRows }, { data: templateRows }] =
    await Promise.all([
      admin
        .from('visits')
        .select('customer_id, visit_date, appointment_id, store_id')
        .gte('visit_date', lookbackStartIso)
        .order('visit_date', { ascending: false }),
      admin
        .from('appointments')
        .select('id, customer_id, pet_id, staff_id, start_time, status')
        .gte('start_time', lookbackStartIso),
      admin.from('customers').select('id, full_name, line_id, store_id'),
      admin.from('pets').select('id, breed, coat_volume, name, store_id'),
      admin
        .from('store_notification_settings')
        .select('store_id, next_visit_line_enabled, next_visit_notice_days_before'),
      admin
        .from('notification_templates')
        .select('store_id, body')
        .eq('template_key', 'next_visit_suggestion_line')
        .eq('channel', 'line')
        .eq('is_active', true),
    ])

  const appointmentById = new Map(
    ((appointments ?? []) as AppointmentRow[]).map((row) => [row.id, row])
  )
  const customerByStoreAndId = new Map(
    ((customers ?? []) as Array<CustomerRow & { store_id: string }>).map((row) => [
      `${row.store_id}:${row.id}`,
      row,
    ])
  )
  const petByStoreAndId = new Map(
    ((pets ?? []) as Array<PetRow & { store_id: string }>).map((row) => [`${row.store_id}:${row.id}`, row])
  )
  const settingsByStoreId = new Map<string, { enabled: boolean; leadDays: number }>()
  ;((settingsRows ?? []) as StoreSettingsRow[]).forEach((row) => {
    settingsByStoreId.set(row.store_id, {
      enabled: row.next_visit_line_enabled ?? true,
      leadDays:
        typeof row.next_visit_notice_days_before === 'number' && Number.isFinite(row.next_visit_notice_days_before)
          ? Math.max(0, Math.min(30, Math.floor(row.next_visit_notice_days_before)))
          : 3,
    })
  })
  const templateByStoreId = new Map<string, string>()
  ;((templateRows ?? []) as TemplateRow[]).forEach((row) => templateByStoreId.set(row.store_id, row.body))

  const lastVisitByStoreCustomer = new Map<string, VisitRow>()
  ;((visits ?? []) as VisitRow[]).forEach((visit) => {
    if (!visit.customer_id) return
    const key = `${visit.store_id}:${visit.customer_id}`
    if (!lastVisitByStoreCustomer.has(key)) {
      lastVisitByStoreCustomer.set(key, visit)
    }
  })

  const futureBookings = new Set(
    ((appointments ?? []) as AppointmentRow[])
      .filter((row) => {
        if (!row.customer_id || !row.start_time) return false
        if (row.status === 'キャンセル' || row.status === '無断キャンセル') return false
        return new Date(row.start_time).getTime() > Date.now()
      })
      .map((row) => `${row.customer_id}:${getJstDate(row.start_time as string)}`)
  )

  let sent = 0
  let skipped = 0

  for (const [key, visit] of lastVisitByStoreCustomer.entries()) {
    const [storeId, customerId] = key.split(':')
    const settings = settingsByStoreId.get(storeId) ?? { enabled: true, leadDays: 3 }
    if (!settings.enabled) {
      skipped += 1
      continue
    }

    const sourceAppointment = visit.appointment_id ? appointmentById.get(visit.appointment_id) ?? null : null
    const customer = customerByStoreAndId.get(`${storeId}:${customerId}`)
    const pet = sourceAppointment?.pet_id ? petByStoreAndId.get(`${storeId}:${sourceAppointment.pet_id}`) ?? null : null
    if (!customer?.line_id || !pet) {
      skipped += 1
      continue
    }

    const intervalDays = getRecommendedVisitIntervalDays({
      breed: pet.breed,
      coatVolume: pet.coat_volume,
    })
    const recommendedAt = addDays(visit.visit_date, intervalDays)
    if (!recommendedAt) {
      skipped += 1
      continue
    }

    const targetSendDateJst = addDaysToJstDate(getJstDate(recommendedAt.toISOString()) ?? todayJst, -settings.leadDays)
    if (targetSendDateJst !== todayJst) {
      skipped += 1
      continue
    }

    if (futureBookings.has(`${customerId}:${getJstDate(recommendedAt.toISOString())}`)) {
      skipped += 1
      continue
    }

    const dedupeKey = makeDedupeKey({
      customerId,
      petId: sourceAppointment?.pet_id ?? null,
      recommendedDateJst: getJstDate(recommendedAt.toISOString()) ?? todayJst,
    })
    const { data: existing } = await admin
      .from('customer_notification_logs')
      .select('id')
      .eq('store_id', storeId)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()
    if (existing) {
      skipped += 1
      continue
    }

    const body = renderNextVisitSuggestionLineTemplate({
      customerName: customer.full_name,
      petName: pet.name,
      lastVisitAt: visit.visit_date,
      recommendedAt: recommendedAt.toISOString(),
      recommendationReason: getRecommendationReason({
        breed: pet.breed,
        coatVolume: pet.coat_volume,
        intervalDays,
      }),
      templateBody: templateByStoreId.get(storeId),
    })

    const sendResult = await sendLineMessage({
      to: customer.line_id,
      messages: [{ type: 'text', text: body }],
    })

    await admin.from('customer_notification_logs').insert({
      store_id: storeId,
      customer_id: customer.id,
      appointment_id: sourceAppointment?.id ?? null,
      channel: 'line',
      notification_type: 'followup',
      status: sendResult.success ? 'sent' : 'failed',
      subject: '次回来店のご提案',
      body,
      target: customer.line_id,
      dedupe_key: dedupeKey,
      payload: {
        template_key: 'next_visit_suggestion_line',
        recommended_at: recommendedAt.toISOString(),
        pet_id: pet.id,
      },
      sent_at: new Date().toISOString(),
    })

    if (sendResult.success) {
      sent += 1
    } else {
      skipped += 1
    }
  }

  return { sent, skipped }
}
