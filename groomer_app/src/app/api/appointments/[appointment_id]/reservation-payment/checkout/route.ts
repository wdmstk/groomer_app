import { NextResponse } from 'next/server'
import { asObject } from '@/lib/object-utils'
import { normalizeReservationPaymentMethod, normalizeReservationPaymentStatus } from '@/lib/appointments/reservation-payment'
import { calculatePaymentTotals, fetchAppointmentMenus } from '@/lib/payments/services/shared'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { findBillingCustomer, upsertBillingCustomer } from '@/lib/billing/db'
import {
  createKomojuOneTimeCheckoutSession,
  createProviderCustomer,
  createStripeOneTimeCheckoutSession,
} from '@/lib/billing/providers'
import { resolveActiveStoreProviderCredentials, type BillingProvider } from '@/lib/billing/provider-connections'

type RouteParams = {
  params: Promise<{
    appointment_id: string
  }>
}

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown, fallback: ProviderType): ProviderType {
  if (value === 'komoju') return 'komoju'
  if (value === 'stripe') return 'stripe'
  return fallback
}

export async function POST(request: Request, { params }: RouteParams) {
  const { appointment_id: appointmentId } = await params
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return NextResponse.json({ message: '所属情報の確認に失敗しました。' }, { status: 403 })
  }

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObject(bodyRaw)

  const [{ data: appointment, error: appointmentError }, { data: settingsRow }, { data: subscriptionRow }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('id, reservation_payment_method, reservation_payment_status')
        .eq('id', appointmentId)
        .eq('store_id', storeId)
        .maybeSingle(),
      supabase
        .from('store_reservation_payment_settings')
        .select('prepayment_enabled')
        .eq('store_id', storeId)
        .maybeSingle(),
      supabase
        .from('store_subscriptions')
        .select('preferred_provider')
        .eq('store_id', storeId)
        .maybeSingle(),
    ])

  if (appointmentError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
  }

  if (!(settingsRow?.prepayment_enabled ?? false)) {
    return NextResponse.json({ message: '事前決済設定が無効です。' }, { status: 400 })
  }

  const method = normalizeReservationPaymentMethod(appointment.reservation_payment_method)
  const status = normalizeReservationPaymentStatus(appointment.reservation_payment_status)
  if (method !== 'prepayment') {
    return NextResponse.json({ message: 'この予約は事前決済対象ではありません。' }, { status: 400 })
  }
  if (status === 'paid' || status === 'captured') {
    return NextResponse.json({ message: 'この予約はすでに決済済みです。' }, { status: 400 })
  }

  const menus = await fetchAppointmentMenus(supabase, storeId, appointmentId)
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
  const email = user.email ?? ''
  if (!email) {
    return NextResponse.json({ message: 'User email is required.' }, { status: 400 })
  }

  const existingCustomer = await findBillingCustomer({
    storeId,
    userId: user.id,
    provider: provider as BillingProvider,
  })
  const providerCustomerId =
    existingCustomer?.provider_customer_id ??
      (await createProviderCustomer({
        provider: provider as BillingProvider,
        email,
        storeId,
        userId: user.id,
        credentials: {
          stripeSecretKey: provider === 'stripe' ? credentials.secretKey : null,
          komojuSecretKey: provider === 'komoju' ? credentials.secretKey : null,
          komojuApiBaseUrl: credentials.komojuApiBaseUrl,
        },
      }))

  await upsertBillingCustomer({
    storeId,
    userId: user.id,
    provider: provider as BillingProvider,
    providerCustomerId,
    email,
  })

  const origin = new URL(request.url).origin
  const successUrl = `${origin}/reservation-management?tab=trimmer&reservation_payment=success&appointment_id=${appointmentId}`
  const cancelUrl = `${origin}/reservation-management?tab=trimmer&reservation_payment=cancel&appointment_id=${appointmentId}`
  const itemName = '予約事前決済'
  const metadata = {
    operation_type: 'reservation_prepayment',
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
          userId: user.id,
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
          userId: user.id,
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
