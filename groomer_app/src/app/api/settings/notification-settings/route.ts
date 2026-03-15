import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'
import { canPurchaseOptionsByPlan } from '@/lib/subscription-plan'
import { asObjectOrNull } from '@/lib/object-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OverLimitBehavior = 'queue' | 'block'

type NotificationSettingsRow = {
  store_id: string
  reminder_line_enabled: boolean
  reminder_email_enabled: boolean
  reminder_day_before_enabled: boolean
  reminder_same_day_enabled: boolean
  reminder_day_before_send_hour_jst: number
  reminder_same_day_send_hour_jst: number
  followup_line_enabled: boolean
  followup_days: number[]
  next_visit_line_enabled: boolean
  next_visit_notice_days_before: number
  slot_reoffer_line_enabled: boolean
  monthly_message_limit: number
  monthly_message_limit_with_option: number
  over_limit_behavior: OverLimitBehavior
}

const DEFAULT_SETTINGS: Omit<NotificationSettingsRow, 'store_id'> = {
  reminder_line_enabled: true,
  reminder_email_enabled: true,
  reminder_day_before_enabled: true,
  reminder_same_day_enabled: true,
  reminder_day_before_send_hour_jst: 18,
  reminder_same_day_send_hour_jst: 9,
  followup_line_enabled: true,
  followup_days: [30, 60],
  next_visit_line_enabled: true,
  next_visit_notice_days_before: 3,
  slot_reoffer_line_enabled: true,
  monthly_message_limit: 1000,
  monthly_message_limit_with_option: 3000,
  over_limit_behavior: 'queue',
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false
  }
  return fallback
}

function toInt(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.floor(value)))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, parsed))
    }
  }
  return fallback
}

function toOverLimitBehavior(value: unknown, fallback: OverLimitBehavior): OverLimitBehavior {
  return value === 'block' ? 'block' : fallback
}

function toFollowupDays(value: unknown, fallback: number[]) {
  let source: unknown[] = []

  if (Array.isArray(value)) {
    source = value
  } else if (typeof value === 'string') {
    const raw = value.trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          source = parsed
        }
      } catch {
        source = []
      }
    } else if (raw.length > 0) {
      source = raw.split(',').map((item) => item.trim())
    }
  }

  const normalized = Array.from(
    new Set(
      source
        .map((item) => {
          if (typeof item === 'number' && Number.isFinite(item)) return Math.floor(item)
          if (typeof item === 'string' && item.length > 0) {
            const parsed = Number.parseInt(item, 10)
            return Number.isFinite(parsed) ? parsed : null
          }
          return null
        })
        .filter((item): item is number => item !== null)
        .filter((item) => item >= 1 && item <= 365)
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 6)

  return normalized.length > 0 ? normalized : fallback
}

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

async function requireOwnerOrAdminContext() {
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
    return {
      ok: false as const,
      status: 403,
      message: membershipError?.message ?? '所属情報の取得に失敗しました。',
    }
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      message: 'この操作は owner/admin のみ実行できます。',
    }
  }

  const planState = await fetchStorePlanOptionState({
    supabase: asStorePlanOptionsClient(supabase),
    storeId,
  })
  if (!canPurchaseOptionsByPlan(planState.planCode)) {
    return {
      ok: false as const,
      status: 403,
      message: '通知設定はスタンダード以上で利用できます。',
    }
  }

  return { ok: true as const, supabase, storeId, user, planState }
}

export async function GET() {
  const guard = await requireOwnerOrAdminContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { data, error } = await guard.supabase
    .from('store_notification_settings')
    .select(
      'store_id, reminder_line_enabled, reminder_email_enabled, reminder_day_before_enabled, reminder_same_day_enabled, reminder_day_before_send_hour_jst, reminder_same_day_send_hour_jst, followup_line_enabled, followup_days, next_visit_line_enabled, next_visit_notice_days_before, slot_reoffer_line_enabled, monthly_message_limit, monthly_message_limit_with_option, over_limit_behavior'
    )
    .eq('store_id', guard.storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      settings: {
        store_id: guard.storeId,
        ...DEFAULT_SETTINGS,
      },
    })
  }

  return NextResponse.json({ settings: data as NotificationSettingsRow })
}

export async function POST(request: Request) {
  const guard = await requireOwnerOrAdminContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const isForm =
    contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
  const formData = isForm ? await request.formData() : null
  const bodyRaw: unknown = formData ? null : await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  const read = (key: string) => formData?.get(key) ?? body?.[key]

  const reminderDayBeforeSendHour = toInt(
    read('reminder_day_before_send_hour_jst'),
    0,
    23,
    DEFAULT_SETTINGS.reminder_day_before_send_hour_jst
  )
  const reminderSameDaySendHour = toInt(
    read('reminder_same_day_send_hour_jst'),
    0,
    23,
    DEFAULT_SETTINGS.reminder_same_day_send_hour_jst
  )
  const monthlyMessageLimit = toInt(
    read('monthly_message_limit'),
    0,
    1_000_000,
    DEFAULT_SETTINGS.monthly_message_limit
  )
  const monthlyMessageLimitWithOptionRaw = toInt(
    read('monthly_message_limit_with_option'),
    0,
    1_000_000,
    DEFAULT_SETTINGS.monthly_message_limit_with_option
  )
  const monthlyMessageLimitWithOption = Math.max(monthlyMessageLimit, monthlyMessageLimitWithOptionRaw)

  const payload = {
    store_id: guard.storeId,
    reminder_line_enabled: toBoolean(read('reminder_line_enabled'), DEFAULT_SETTINGS.reminder_line_enabled),
    reminder_email_enabled: toBoolean(read('reminder_email_enabled'), DEFAULT_SETTINGS.reminder_email_enabled),
    reminder_day_before_enabled: toBoolean(
      read('reminder_day_before_enabled'),
      DEFAULT_SETTINGS.reminder_day_before_enabled
    ),
    reminder_same_day_enabled: toBoolean(read('reminder_same_day_enabled'), DEFAULT_SETTINGS.reminder_same_day_enabled),
    reminder_day_before_send_hour_jst: reminderDayBeforeSendHour,
    reminder_same_day_send_hour_jst: reminderSameDaySendHour,
    followup_line_enabled: toBoolean(read('followup_line_enabled'), DEFAULT_SETTINGS.followup_line_enabled),
    followup_days: toFollowupDays(read('followup_days'), DEFAULT_SETTINGS.followup_days),
    next_visit_line_enabled: toBoolean(read('next_visit_line_enabled'), DEFAULT_SETTINGS.next_visit_line_enabled),
    next_visit_notice_days_before: toInt(
      read('next_visit_notice_days_before'),
      0,
      30,
      DEFAULT_SETTINGS.next_visit_notice_days_before
    ),
    slot_reoffer_line_enabled: toBoolean(read('slot_reoffer_line_enabled'), DEFAULT_SETTINGS.slot_reoffer_line_enabled),
    monthly_message_limit: monthlyMessageLimit,
    monthly_message_limit_with_option: monthlyMessageLimitWithOption,
    over_limit_behavior: toOverLimitBehavior(read('over_limit_behavior'), DEFAULT_SETTINGS.over_limit_behavior),
    updated_by_user_id: guard.user.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = await guard.supabase
    .from('store_notification_settings')
    .upsert(payload, { onConflict: 'store_id' })

  if (error) {
    if (!formData) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
    const url = new URL(redirectTo ?? '/settings/notifications', request.url)
    url.searchParams.set('error', error.message)
    return NextResponse.redirect(url)
  }

  if (!formData) {
    return NextResponse.json({ ok: true })
  }

  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const url = new URL(redirectTo ?? '/settings/notifications', request.url)
  url.searchParams.set('saved', '1')
  return NextResponse.redirect(url)
}
