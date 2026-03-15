import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import {
  DEFAULT_RESERVATION_PAYMENT_SETTINGS,
  type NoShowChargeMode,
} from '@/lib/appointments/reservation-payment'
import { createStoreScopedClient } from '@/lib/supabase/store'

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false
  }
  return fallback
}

function toPercent(value: unknown, fallback: number) {
  const resolved =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN
  if (!Number.isFinite(resolved)) return fallback
  return Math.max(0, Math.min(100, Math.floor(resolved)))
}

function toChargeMode(value: unknown, fallback: NoShowChargeMode): NoShowChargeMode {
  return value === 'auto' ? 'auto' : fallback
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

  return { ok: true as const, supabase, storeId, user }
}

export async function GET() {
  const guard = await requireOwnerOrAdminContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { data, error } = await guard.supabase
    .from('store_reservation_payment_settings')
    .select(
      'store_id, prepayment_enabled, card_hold_enabled, cancellation_day_before_percent, cancellation_same_day_percent, cancellation_no_show_percent, no_show_charge_mode'
    )
    .eq('store_id', guard.storeId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    settings: data ?? {
      store_id: guard.storeId,
      ...DEFAULT_RESERVATION_PAYMENT_SETTINGS,
    },
  })
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

  const payload = {
    store_id: guard.storeId,
    prepayment_enabled: toBoolean(read('prepayment_enabled'), DEFAULT_RESERVATION_PAYMENT_SETTINGS.prepayment_enabled),
    card_hold_enabled: toBoolean(read('card_hold_enabled'), DEFAULT_RESERVATION_PAYMENT_SETTINGS.card_hold_enabled),
    cancellation_day_before_percent: toPercent(
      read('cancellation_day_before_percent'),
      DEFAULT_RESERVATION_PAYMENT_SETTINGS.cancellation_day_before_percent
    ),
    cancellation_same_day_percent: toPercent(
      read('cancellation_same_day_percent'),
      DEFAULT_RESERVATION_PAYMENT_SETTINGS.cancellation_same_day_percent
    ),
    cancellation_no_show_percent: toPercent(
      read('cancellation_no_show_percent'),
      DEFAULT_RESERVATION_PAYMENT_SETTINGS.cancellation_no_show_percent
    ),
    no_show_charge_mode: toChargeMode(
      read('no_show_charge_mode'),
      DEFAULT_RESERVATION_PAYMENT_SETTINGS.no_show_charge_mode
    ),
    updated_by_user_id: guard.user.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = await guard.supabase
    .from('store_reservation_payment_settings')
    .upsert(payload, { onConflict: 'store_id' })

  if (error) {
    if (!formData) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
    const url = new URL(redirectTo ?? '/settings/public-reserve', request.url)
    url.searchParams.set('error', error.message)
    return NextResponse.redirect(url)
  }

  if (!formData) {
    return NextResponse.json({ ok: true })
  }

  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const url = new URL(redirectTo ?? '/settings/public-reserve', request.url)
  url.searchParams.set('saved', '1')
  return NextResponse.redirect(url)
}
