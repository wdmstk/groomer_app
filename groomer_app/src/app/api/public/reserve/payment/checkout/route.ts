import { NextResponse } from 'next/server'
import { asObject } from '@/lib/object-utils'
import { verifyReservationPaymentToken } from '@/lib/reservation-cancel-token'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { normalizeReservationPaymentMethod, normalizeReservationPaymentStatus } from '@/lib/appointments/reservation-payment'
import { calculatePaymentTotals, fetchAppointmentMenus } from '@/lib/payments/services/shared'
import {
  createKomojuOneTimeCheckoutSession,
  createProviderCustomer,
  createStripeOneTimeCheckoutSession,
} from '@/lib/billing/providers'
import { resolveActiveStoreProviderCredentials, type BillingProvider } from '@/lib/billing/provider-connections'
import { findBillingCustomer, upsertBillingCustomer } from '@/lib/billing/db'

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown, fallback: ProviderType): ProviderType {
  if (value === 'komoju') return 'komoju'
  if (value === 'stripe') return 'stripe'
  return fallback
}

export async function POST(request: Request) {
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObject(bodyRaw)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ message: '決済トークンが必要です。' }, { status: 400 })
  }

  const verified = verifyReservationPaymentToken(token)
  if (!verified.valid) {
    const message =
      verified.reason === 'expired'
        ? '決済トークンの有効期限が切れています。'
        : '決済トークンが不正です。'
    return NextResponse.json({ message }, { status: 400 })
  }

  const { appointmentId, storeId } = verified.payload
  const admin = createAdminSupabaseClient()
  const [{ data: appointment, error: appointmentError }, { data: settingsRow }, { data: subscriptionRow }] =
    await Promise.all([
      admin
        .from('appointments')
        .select('id, customer_id, reservation_payment_method, reservation_payment_status')
        .eq('id', appointmentId)
        .eq('store_id', storeId)
        .maybeSingle(),
      admin
        .from('store_reservation_payment_settings')
        .select('prepayment_enabled, card_hold_enabled')
        .eq('store_id', storeId)
        .maybeSingle(),
      admin
        .from('store_subscriptions')
        .select('preferred_provider')
        .eq('store_id', storeId)
        .maybeSingle(),
    ])

  if (appointmentError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  const method = normalizeReservationPaymentMethod(appointment.reservation_payment_method)
  const status = normalizeReservationPaymentStatus(appointment.reservation_payment_status)
  if (method !== 'prepayment' && method !== 'card_hold') {
    return NextResponse.json({ message: 'この予約は事前決済対象ではありません。' }, { status: 400 })
  }
  if (method === 'prepayment' && !(settingsRow?.prepayment_enabled ?? false)) {
    return NextResponse.json({ message: '事前決済設定が無効です。' }, { status: 400 })
  }
  if (method === 'card_hold' && !(settingsRow?.card_hold_enabled ?? false)) {
    return NextResponse.json({ message: '承認後決済設定が無効です。' }, { status: 400 })
  }
  if (method === 'prepayment' && (status === 'paid' || status === 'captured')) {
    return NextResponse.json({ message: 'この予約はすでに決済済みです。' }, { status: 400 })
  }
  if (method === 'card_hold' && (status === 'authorized' || status === 'captured')) {
    return NextResponse.json({ message: 'この予約はすでに決済情報を取得済みです。' }, { status: 400 })
  }

  const { data: customer } = await admin
    .from('customers')
    .select('id, email')
    .eq('id', appointment.customer_id)
    .eq('store_id', storeId)
    .maybeSingle()
  const email = customer?.email?.trim() ?? ''
  if (!email) {
    return NextResponse.json({ message: '顧客メールが未登録のため決済を開始できません。' }, { status: 400 })
  }

  const menus = await fetchAppointmentMenus(admin, storeId, appointmentId)
  const totals = calculatePaymentTotals(menus)
  const amountJpy = Math.round(Math.max(0, totals.total))
  if (amountJpy <= 0) {
    return NextResponse.json({ message: '決済対象金額が0円のため開始できません。' }, { status: 400 })
  }

  const preferredProvider = subscriptionRow?.preferred_provider === 'komoju' ? 'komoju' : 'stripe'
  const provider = parseProvider(body.provider, preferredProvider)
  const credentials = await resolveActiveStoreProviderCredentials({
    storeId,
    provider: provider as BillingProvider,
  })
  if (!credentials) {
    return NextResponse.json(
      { message: `${provider === 'stripe' ? 'Stripe' : 'KOMOJU'} の店舗接続設定が未完了です。` },
      { status: 400 }
    )
  }

  const syntheticUserId = `public:${appointment.customer_id}`
  const existingCustomer = await findBillingCustomer({
    storeId,
    userId: syntheticUserId,
    provider: provider as BillingProvider,
  })
  const providerCustomerId =
    existingCustomer?.provider_customer_id ??
    (await createProviderCustomer({
      provider: provider as BillingProvider,
      email,
      storeId,
      userId: syntheticUserId,
      credentials: {
        stripeSecretKey: provider === 'stripe' ? credentials.secretKey : null,
        komojuSecretKey: provider === 'komoju' ? credentials.secretKey : null,
        komojuApiBaseUrl: credentials.komojuApiBaseUrl,
      },
    }))

  await upsertBillingCustomer({
    storeId,
    userId: syntheticUserId,
    provider: provider as BillingProvider,
    providerCustomerId,
    email,
  })

  const origin = new URL(request.url).origin
  const successUrl = `${origin}/reserve/${storeId}?reservation_payment=success&appointment_id=${appointmentId}`
  const cancelUrl = `${origin}/reserve/${storeId}?reservation_payment=cancel&appointment_id=${appointmentId}`
  const itemName = method === 'prepayment' ? '予約事前決済' : '予約仮押さえ'
  const metadata = {
    operation_type: method === 'prepayment' ? 'reservation_prepayment' : 'reservation_card_hold',
    appointment_id: appointmentId,
    amount_jpy: String(amountJpy),
  }

  const session =
    provider === 'stripe'
      ? await createStripeOneTimeCheckoutSession({
          customerId: providerCustomerId,
          successUrl,
          cancelUrl,
          amountJpy,
          itemName,
          storeId,
          userId: syntheticUserId,
          metadata,
          credentials: {
            stripeSecretKey: credentials.secretKey,
          },
        })
      : await createKomojuOneTimeCheckoutSession({
          customerId: providerCustomerId,
          returnUrl: successUrl,
          amountJpy,
          itemName,
          storeId,
          userId: syntheticUserId,
          metadata,
          credentials: {
            komojuSecretKey: credentials.secretKey,
            komojuApiBaseUrl: credentials.komojuApiBaseUrl,
          },
        })

  return NextResponse.json({
    checkout_url: session.url,
    session_id: session.id,
    provider,
    amount_jpy: amountJpy,
  })
}
