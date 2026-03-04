import { sendEmail } from '@/lib/resend'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { hasBillingNotificationSent, logBillingNotification } from '@/lib/billing/db'

type StoreSubscriptionRow = {
  store_id: string
  billing_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'
  trial_started_at: string | null
  trial_days: number | null
  past_due_since: string | null
  stores?: { name: string | null } | { name: string | null }[] | null
}

type MembershipRow = {
  user_id: string
}

function resolveStoreName(relation: StoreSubscriptionRow['stores']) {
  if (!relation) return '店舗名未設定'
  if (Array.isArray(relation)) return relation[0]?.name ?? '店舗名未設定'
  return relation.name ?? '店舗名未設定'
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function trialDaysLeft(trialStartedAt: string | null, trialDays: number | null) {
  if (!trialStartedAt) return null
  const start = new Date(`${trialStartedAt}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(0, trialDays ?? 30))
  const diffMs = end.getTime() - startOfDay(new Date()).getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

async function resolveOwnerEmails(admin: ReturnType<typeof createAdminSupabaseClient>, storeId: string) {
  const { data: memberships, error } = await admin
    .from('store_memberships')
    .select('user_id')
    .eq('store_id', storeId)
    .eq('role', 'owner')
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  const rows = (memberships ?? []) as MembershipRow[]
  const emails: string[] = []
  for (const row of rows) {
    const { data, error: userError } = await admin.auth.admin.getUserById(row.user_id)
    if (userError) continue
    const email = data.user?.email?.trim().toLowerCase()
    if (email) emails.push(email)
  }
  return Array.from(new Set(emails))
}

async function notifyWithDedup(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  storeId: string
  kind: string
  subject: string
  html: string
}) {
  const emails = await resolveOwnerEmails(params.admin, params.storeId)
  let sent = 0
  for (const email of emails) {
    const alreadySent = await hasBillingNotificationSent({
      storeId: params.storeId,
      kind: params.kind,
      target: email,
    })
    if (alreadySent) continue
    const result = await sendEmail({
      to: email,
      subject: params.subject,
      html: params.html,
    })
    if (result.success) {
      await logBillingNotification({
        storeId: params.storeId,
        kind: params.kind,
        target: email,
      })
      sent += 1
    }
  }
  return sent
}

export async function runBillingRemindersJob() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('store_subscriptions')
    .select('store_id, billing_status, trial_started_at, trial_days, past_due_since, stores(name)')

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as StoreSubscriptionRow[]
  let sent = 0
  const notifiedStoreIds = new Set<string>()
  const notificationKinds = new Set<string>()
  for (const row of rows) {
    const storeName = resolveStoreName(row.stores)
    if (row.billing_status === 'trialing') {
      const daysLeft = trialDaysLeft(row.trial_started_at, row.trial_days)
      if (daysLeft === null) continue
      const remindAt = [7, 3, 0]
      if (!remindAt.includes(daysLeft)) continue
      const kind = `trial_end_${daysLeft}d:${row.trial_started_at ?? 'unknown'}`
      const subject =
        daysLeft === 0
          ? `【重要】${storeName} の試用期間が本日終了します`
          : `【お知らせ】${storeName} の試用期間終了まで ${daysLeft} 日です`
      const html = `
        <p>${storeName} のサブスク課金リマインドです。</p>
        <p>試用期間終了まで: <strong>${daysLeft} 日</strong></p>
        <p>継続利用のため、課金設定をご確認ください。</p>
      `
      sent += await notifyWithDedup({
        admin,
        storeId: row.store_id,
        kind,
        subject,
        html,
      })
      notifiedStoreIds.add(row.store_id)
      notificationKinds.add(kind)
      continue
    }

    if (row.billing_status === 'past_due') {
      const keyDate = row.past_due_since?.slice(0, 10) ?? 'unknown'
      const kind = `past_due_started:${keyDate}`
      const subject = `【要対応】${storeName} の決済が失敗しました（past_due）`
      const html = `
        <p>${storeName} で支払い失敗（past_due）が発生しています。</p>
        <p>猶予期間内に決済情報の更新をお願いします。</p>
      `
      sent += await notifyWithDedup({
        admin,
        storeId: row.store_id,
        kind,
        subject,
        html,
      })
      notifiedStoreIds.add(row.store_id)
      notificationKinds.add(kind)
    }
  }

  return {
    scanned: rows.length,
    sent,
    counters: {
      scanned: rows.length,
      sent,
      storesNotified: notifiedStoreIds.size,
      notificationKinds: notificationKinds.size,
    },
    notifiedStoreIds: Array.from(notifiedStoreIds),
    notificationKinds: Array.from(notificationKinds),
  }
}
