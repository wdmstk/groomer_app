import { sendLineMessage } from '@/lib/line'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { isHotelFeatureEnabledForStore } from '@/lib/hotel/feature-gate'
import { canPurchaseOptionsByPlan, normalizePlanCode } from '@/lib/subscription-plan'
import {
  buildHotelVaccineAlertMessage,
  buildHotelVaccineDedupeKey,
  classifyVaccineAlertLevel,
  diffDaysDateKey,
  getJstTodayDateKey,
} from './hotel-vaccine-alerts-core'

type HotelStayRow = {
  id: string
  store_id: string
  customer_id: string | null
  pet_id: string
  vaccine_expires_on: string | null
  status: string
}

type CustomerRow = {
  id: string
  full_name: string
  line_id: string | null
}

type PetRow = {
  id: string
  customer_id: string | null
  name: string
}

export async function runHotelVaccineAlertsJob() {
  const admin = createAdminSupabaseClient()
  const todayJst = getJstTodayDateKey()

  const { data: stays, error } = await admin
    .from('hotel_stays')
    .select('id, store_id, customer_id, pet_id, vaccine_expires_on, status')
    .in('status', ['reserved', 'checked_in'])
    .not('vaccine_expires_on', 'is', null)

  if (error) {
    throw new Error(error.message)
  }

  const stayRows = (stays ?? []) as HotelStayRow[]
  if (stayRows.length === 0) {
    return {
      scanned: 0,
      sent: 0,
      skipped: 0,
      counters: { scanned: 0, sent: 0, skipped: 0, failed: 0, dedupe: 0, no_line: 0, disabled_store: 0 },
    }
  }

  const storeIds = Array.from(new Set(stayRows.map((row) => row.store_id)))
  const { data: subscriptionRows } = await admin
    .from('store_subscriptions')
    .select('store_id, plan_code, hotel_option_effective, hotel_option_enabled')
    .in('store_id', storeIds)
  const hotelOptionByStoreId = new Map(
    (subscriptionRows ?? []).map((row) => {
      const planCode = normalizePlanCode((row.plan_code as string | null) ?? 'light')
      const enabled =
        canPurchaseOptionsByPlan(planCode) &&
        ((row.hotel_option_effective as boolean | null) ?? (row.hotel_option_enabled as boolean | null) ?? false) === true
      return [row.store_id as string, enabled]
    })
  )

  const petIds = Array.from(new Set(stayRows.map((row) => row.pet_id)))
  const customerIds = Array.from(new Set(stayRows.map((row) => row.customer_id).filter((value): value is string => Boolean(value))))

  const [{ data: pets }, { data: customersFromStay }] = await Promise.all([
    admin.from('pets').select('id, customer_id, name').in('id', petIds),
    customerIds.length > 0
      ? admin.from('customers').select('id, full_name, line_id').in('id', customerIds)
      : Promise.resolve({ data: [] as CustomerRow[] }),
  ])

  const petMap = new Map((pets ?? []).map((row) => [row.id, row as PetRow]))
  const customerMap = new Map((customersFromStay ?? []).map((row) => [row.id, row as CustomerRow]))

  const missingCustomerIds: string[] = []
  for (const pet of (pets ?? []) as PetRow[]) {
    if (pet.customer_id && !customerMap.has(pet.customer_id)) {
      missingCustomerIds.push(pet.customer_id)
    }
  }
  if (missingCustomerIds.length > 0) {
    const { data: extraCustomers } = await admin
      .from('customers')
      .select('id, full_name, line_id')
      .in('id', Array.from(new Set(missingCustomerIds)))
    for (const row of (extraCustomers ?? []) as CustomerRow[]) {
      customerMap.set(row.id, row)
    }
  }

  let sent = 0
  let skipped = 0
  let failed = 0
  let dedupe = 0
  let noLine = 0
  let disabledStore = 0

  for (const stay of stayRows) {
    if (!hotelOptionByStoreId.get(stay.store_id)) {
      skipped += 1
      disabledStore += 1
      continue
    }
    if (!isHotelFeatureEnabledForStore(stay.store_id)) {
      skipped += 1
      disabledStore += 1
      continue
    }
    if (!stay.vaccine_expires_on) {
      skipped += 1
      continue
    }

    const daysRemaining = diffDaysDateKey(stay.vaccine_expires_on, todayJst)
    if (daysRemaining === null) {
      skipped += 1
      continue
    }
    const level = classifyVaccineAlertLevel(daysRemaining)
    if (!level) {
      skipped += 1
      continue
    }

    const pet = petMap.get(stay.pet_id)
    const resolvedCustomerId = stay.customer_id ?? pet?.customer_id ?? null
    const customer = resolvedCustomerId ? customerMap.get(resolvedCustomerId) : null
    const lineId = customer?.line_id ?? null
    if (!lineId) {
      skipped += 1
      noLine += 1
      continue
    }

    const dedupeKey = buildHotelVaccineDedupeKey({
      stayId: stay.id,
      vaccineDateKey: stay.vaccine_expires_on,
      alertLevel: level,
      todayJst,
    })
    const { data: existing } = await admin
      .from('customer_notification_logs')
      .select('id')
      .eq('store_id', stay.store_id)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()
    if (existing) {
      skipped += 1
      dedupe += 1
      continue
    }

    const customerName = customer?.full_name ?? 'お客様'
    const petName = pet?.name ?? 'ペット'
    const body = buildHotelVaccineAlertMessage({
      customerName,
      petName,
      vaccineDateKey: stay.vaccine_expires_on,
      daysRemaining,
    })
    const subject = 'ワクチン期限アラート'

    const { data: reserved, error: reserveError } = await admin
      .from('customer_notification_logs')
      .insert({
        store_id: stay.store_id,
        customer_id: resolvedCustomerId,
        actor_user_id: null,
        channel: 'line',
        notification_type: 'other',
        status: 'queued',
        subject,
        body,
        target: lineId,
        dedupe_key: dedupeKey,
        payload: {
          kind: 'hotel_vaccine_expiry',
          stay_id: stay.id,
          pet_id: stay.pet_id,
          vaccine_expires_on: stay.vaccine_expires_on,
          days_remaining: daysRemaining,
          alert_level: level,
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (reserveError || !reserved?.id) {
      skipped += 1
      failed += 1
      continue
    }

    try {
      const result = await sendLineMessage({
        to: lineId,
        messages: [{ type: 'text', text: body }],
      })
      if (!result.success) {
        throw new Error(result.error ?? 'line_send_failed')
      }

      await admin
        .from('customer_notification_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', reserved.id)
      sent += 1
    } catch (sendError) {
      await admin
        .from('customer_notification_logs')
        .update({
          status: 'failed',
          payload: {
            kind: 'hotel_vaccine_expiry',
            stay_id: stay.id,
            pet_id: stay.pet_id,
            vaccine_expires_on: stay.vaccine_expires_on,
            days_remaining: daysRemaining,
            alert_level: level,
            reason: sendError instanceof Error ? sendError.message : 'send_failed',
          },
          sent_at: new Date().toISOString(),
        })
        .eq('id', reserved.id)
      skipped += 1
      failed += 1
    }
  }

  return {
    scanned: stayRows.length,
    sent,
    skipped,
    counters: {
      scanned: stayRows.length,
      sent,
      skipped,
      failed,
      dedupe,
      no_line: noLine,
      disabled_store: disabledStore,
    },
  }
}
