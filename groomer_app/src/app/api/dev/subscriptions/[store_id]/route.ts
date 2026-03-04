import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

type RouteParams = {
  params: Promise<{
    store_id: string
  }>
}

const ALLOWED_STATUSES = new Set([
  'inactive',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
])

const ALLOWED_BILLING_CYCLES = new Set(['monthly', 'yearly', 'custom'])
const ALLOWED_PROVIDERS = new Set(['stripe', 'komoju', ''])

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed
}

function normalizeInt(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function redirectWithMessage(request: Request, message: string) {
  const url = new URL('/dev/subscriptions', request.url)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { message: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  const { store_id: storeId } = await params

  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .maybeSingle()

  if (storeError) {
    return NextResponse.json({ message: storeError.message }, { status: 500 })
  }

  if (!store) {
    return NextResponse.json({ message: '対象店舗が見つかりません。' }, { status: 404 })
  }

  const formData = await request.formData()
  const planCode = formData.get('plan_code')?.toString().trim() ?? ''
  const billingStatus = formData.get('billing_status')?.toString().trim() ?? ''
  const billingCycle = formData.get('billing_cycle')?.toString().trim() ?? ''
  const amountRaw = formData.get('amount_jpy')?.toString().trim() ?? '0'
  const nextBillingDateRaw = formData.get('next_billing_date')?.toString() ?? ''
  const periodStartRaw = formData.get('current_period_start')?.toString() ?? ''
  const periodEndRaw = formData.get('current_period_end')?.toString() ?? ''
  const notes = formData.get('notes')?.toString().trim() ?? ''
  const trialDaysRaw = formData.get('trial_days')?.toString().trim() ?? '30'
  const graceDaysRaw = formData.get('grace_days')?.toString().trim() ?? '3'
  const trialStartedAtRaw = formData.get('trial_started_at')?.toString() ?? ''
  const preferredProvider = formData.get('preferred_provider')?.toString().trim() ?? ''

  if (!planCode) {
    return redirectWithMessage(request, 'plan_code は必須です。')
  }
  if (!ALLOWED_STATUSES.has(billingStatus)) {
    return redirectWithMessage(request, 'billing_status が不正です。')
  }
  if (!ALLOWED_BILLING_CYCLES.has(billingCycle)) {
    return redirectWithMessage(request, 'billing_cycle が不正です。')
  }
  if (!ALLOWED_PROVIDERS.has(preferredProvider)) {
    return redirectWithMessage(request, 'preferred_provider が不正です。')
  }

  const amountJpy = Number.parseInt(amountRaw, 10)
  if (!Number.isFinite(amountJpy) || amountJpy < 0) {
    return redirectWithMessage(request, 'amount_jpy は 0 以上の整数で指定してください。')
  }

  const currentPeriodStart = normalizeDate(periodStartRaw)
  const currentPeriodEnd = normalizeDate(periodEndRaw)
  const nextBillingDate = normalizeDate(nextBillingDateRaw)
  const trialStartedAt = normalizeDate(trialStartedAtRaw)
  const trialDays = normalizeInt(trialDaysRaw, 30)
  const graceDays = normalizeInt(graceDaysRaw, 3)

  if (periodStartRaw.trim() && !currentPeriodStart) {
    return redirectWithMessage(request, 'current_period_start は YYYY-MM-DD 形式で指定してください。')
  }
  if (periodEndRaw.trim() && !currentPeriodEnd) {
    return redirectWithMessage(request, 'current_period_end は YYYY-MM-DD 形式で指定してください。')
  }
  if (nextBillingDateRaw.trim() && !nextBillingDate) {
    return redirectWithMessage(request, 'next_billing_date は YYYY-MM-DD 形式で指定してください。')
  }
  if (trialStartedAtRaw.trim() && !trialStartedAt) {
    return redirectWithMessage(request, 'trial_started_at は YYYY-MM-DD 形式で指定してください。')
  }
  if (trialDays < 0 || trialDays > 3650) {
    return redirectWithMessage(request, 'trial_days は 0 以上 3650 以下で指定してください。')
  }
  if (graceDays < 0 || graceDays > 365) {
    return redirectWithMessage(request, 'grace_days は 0 以上 365 以下で指定してください。')
  }

  const nowIso = new Date().toISOString()
  const payload = {
    store_id: storeId,
    plan_code: planCode,
    billing_status: billingStatus,
    billing_cycle: billingCycle,
    amount_jpy: amountJpy,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    next_billing_date: nextBillingDate,
    trial_days: trialDays,
    grace_days: graceDays,
    trial_started_at: trialStartedAt ?? new Date().toISOString().slice(0, 10),
    preferred_provider: preferredProvider || null,
    notes: notes || null,
    updated_at: nowIso,
  }

  const { error: upsertError } = await admin
    .from('store_subscriptions')
    .upsert(payload, { onConflict: 'store_id' })

  if (upsertError) {
    return redirectWithMessage(request, `更新に失敗しました: ${upsertError.message}`)
  }

  return redirectWithMessage(request, '更新しました。')
}
