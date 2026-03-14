import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { hasBillingOperation, insertBillingOperation } from '@/lib/billing/db'
import {
  calculateNotificationUsageCharge,
  countUniqueSentMessagesByStore,
  getPreviousMonthJstPeriod,
} from './notification-usage-billing-core'

type NotificationLogRow = {
  id: string
  store_id: string
  dedupe_key: string | null
}

type StoreNotificationSettingsRow = {
  store_id: string
  monthly_message_limit: number | null
  monthly_message_limit_with_option: number | null
}

type StoreSubscriptionRow = {
  store_id: string
  preferred_provider: 'stripe' | 'komoju' | null
  notification_option_enabled: boolean | null
}

export async function runNotificationUsageBillingJob(params?: {
  targetMonthJst?: string
  jobRunId?: string | null
  dryRun?: boolean
  targetStoreIds?: string[]
}) {
  const admin = createAdminSupabaseClient()
  const dryRun = params?.dryRun === true
  const period = params?.targetMonthJst
    ? (() => {
        const month = params.targetMonthJst.trim()
        const start = new Date(`${month}-01T00:00:00+09:00`)
        const [yearRaw, monthRaw] = month.split('-')
        const year = Number.parseInt(yearRaw ?? '', 10)
        const monthNum = Number.parseInt(monthRaw ?? '', 10)
        const nextYear = monthNum === 12 ? year + 1 : year
        const nextMonth = monthNum === 12 ? 1 : monthNum + 1
        const nextStart = new Date(
          `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`
        )
        return {
          monthJst: `${month}-01`,
          periodStartIso: start.toISOString(),
          periodEndIso: new Date(nextStart.getTime() - 1).toISOString(),
        }
      })()
    : getPreviousMonthJstPeriod()

  const { data: rows, error } = await admin
    .from('customer_notification_logs')
    .select('id, store_id, dedupe_key')
    .eq('channel', 'line')
    .in('notification_type', ['reminder', 'followup', 'slot_reoffer'])
    .eq('status', 'sent')
    .gte('sent_at', period.periodStartIso)
    .lte('sent_at', period.periodEndIso)

  if (error) {
    throw new Error(error.message)
  }

  const logRows = (rows ?? []) as NotificationLogRow[]
  const countedByStore = countUniqueSentMessagesByStore(logRows)
  const filteredStoreIds =
    params?.targetStoreIds && params.targetStoreIds.length > 0
      ? new Set(params.targetStoreIds)
      : null
  const storeIds = Array.from(countedByStore.keys()).filter((storeId) =>
    filteredStoreIds ? filteredStoreIds.has(storeId) : true
  )

  if (storeIds.length === 0) {
    return {
      month_jst: period.monthJst,
      scanned: 0,
      stores: 0,
      billedStores: 0,
      totalAmountJpy: 0,
      insertedOperations: 0,
      counters: {
        scanned: 0,
        stores: 0,
        billedStores: 0,
        totalAmountJpy: 0,
        insertedOperations: 0,
      },
      dryRun,
      storeSummaries: [] as Array<{
        storeId: string
        sentCount: number
        appliedLimit: number
        billableMessages: number
        amountJpy: number
        optionEnabled: boolean
        provider: 'stripe' | 'komoju'
      }>,
    }
  }

  const [{ data: settingsRows }, { data: subscriptionRows }] = await Promise.all([
    admin
      .from('store_notification_settings')
      .select('store_id, monthly_message_limit, monthly_message_limit_with_option')
      .in('store_id', storeIds),
    admin
      .from('store_subscriptions')
      .select('store_id, preferred_provider, notification_option_enabled')
      .in('store_id', storeIds),
  ])

  const settingsByStore = new Map<string, StoreNotificationSettingsRow>()
  for (const row of (settingsRows ?? []) as StoreNotificationSettingsRow[]) {
    settingsByStore.set(row.store_id, row)
  }

  const providerByStore = new Map<string, 'stripe' | 'komoju'>()
  const notificationOptionByStore = new Map<string, boolean>()
  for (const row of (subscriptionRows ?? []) as StoreSubscriptionRow[]) {
    providerByStore.set(row.store_id, row.preferred_provider === 'komoju' ? 'komoju' : 'stripe')
    notificationOptionByStore.set(row.store_id, row.notification_option_enabled === true)
  }

  let billedStores = 0
  let totalAmountJpy = 0
  let insertedOperations = 0
  const storeSummaries: Array<{
    storeId: string
    sentCount: number
    appliedLimit: number
    billableMessages: number
    amountJpy: number
    optionEnabled: boolean
    provider: 'stripe' | 'komoju'
  }> = []

  for (const storeId of storeIds) {
    const sentCount = countedByStore.get(storeId) ?? 0
    const settings = settingsByStore.get(storeId)
    const monthlyLimit = Math.max(0, Math.floor(settings?.monthly_message_limit ?? 1000))
    const monthlyLimitWithOption = Math.max(
      monthlyLimit,
      Math.floor(settings?.monthly_message_limit_with_option ?? 3000)
    )
    const optionEnabled = notificationOptionByStore.get(storeId) === true
    const provider = providerByStore.get(storeId) ?? 'stripe'

    const summary = calculateNotificationUsageCharge({
      sentCount,
      config: {
        monthlyLimit,
        monthlyLimitWithOption,
        optionEnabled,
      },
      unitPriceJpy: 3,
    })

    if (!dryRun) {
      await admin
        .from('notification_usage_billing_monthly')
        .upsert(
          {
            store_id: storeId,
            month_jst: period.monthJst,
            period_start: period.periodStartIso,
            period_end: period.periodEndIso,
            counted_sent_messages: summary.countedSentMessages,
            applied_limit: summary.appliedLimit,
            billable_messages: summary.billableMessages,
            unit_price_jpy: summary.unitPriceJpy,
            amount_jpy: summary.amountJpy,
            option_enabled: optionEnabled,
            detail: {
              channel: 'line',
              notification_types: ['reminder', 'followup', 'slot_reoffer'],
              dedupe: 'dedupe_key_or_id',
            },
            calculated_at: new Date().toISOString(),
            calculated_by_job_run_id: params?.jobRunId ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'store_id,month_jst' }
        )
    }

    if (summary.amountJpy > 0) {
      billedStores += 1
      totalAmountJpy += summary.amountJpy
    }

    const resultMessage = `notification_usage_month=${period.monthJst}`
    if (!dryRun) {
      const alreadyInserted = await hasBillingOperation({
        storeId,
        provider,
        operationType: 'notification_usage_billing_calculated',
        resultMessage,
      })
      if (!alreadyInserted) {
        await insertBillingOperation({
          storeId,
          provider,
          operationType: 'notification_usage_billing_calculated',
          amountJpy: summary.amountJpy,
          reason: `notification_usage_count=${summary.countedSentMessages},limit=${summary.appliedLimit},billable=${summary.billableMessages}`,
          status: 'succeeded',
          resultMessage,
        })
        insertedOperations += 1
      }
    }

    storeSummaries.push({
      storeId,
      sentCount: summary.countedSentMessages,
      appliedLimit: summary.appliedLimit,
      billableMessages: summary.billableMessages,
      amountJpy: summary.amountJpy,
      optionEnabled,
      provider,
    })
  }

  return {
    month_jst: period.monthJst,
    scanned: logRows.length,
    stores: storeIds.length,
    billedStores,
    totalAmountJpy,
    insertedOperations,
    counters: {
      scanned: logRows.length,
      stores: storeIds.length,
      billedStores,
      totalAmountJpy,
      insertedOperations,
    },
    dryRun,
    storeSummaries,
  }
}
