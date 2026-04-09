import { NextResponse } from 'next/server'
import { asObject } from '@/lib/object-utils'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { calculatePaymentTotals, fetchAppointmentMenus, findPaymentByAppointment } from '@/lib/payments/services/shared'
import { findBillingCustomer, upsertBillingCustomer } from '@/lib/billing/db'
import {
  createKomojuOneTimeCheckoutSession,
  createProviderCustomer,
  createStripeOneTimeCheckoutSession,
} from '@/lib/billing/providers'
import { resolveActiveStoreProviderCredentials, type BillingProvider } from '@/lib/billing/provider-connections'

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown, fallback: ProviderType): ProviderType {
  if (value === 'komoju') return 'komoju'
  if (value === 'stripe') return 'stripe'
  return fallback
}

function parseNonNegativeInt(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return Math.max(0, parsed)
  }
  return fallback
}

export async function POST(request: Request) {
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
  const appointmentId = typeof body.appointment_id === 'string' ? body.appointment_id : ''
  if (!appointmentId) {
    return NextResponse.json({ message: 'appointment_id is required.' }, { status: 400 })
  }

  const [{ data: subscriptionRow }, { data: appointment, error: appointmentError }] = await Promise.all([
    supabase
      .from('store_subscriptions')
      .select('preferred_provider')
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('id')
      .eq('store_id', storeId)
      .eq('id', appointmentId)
      .maybeSingle(),
  ])

  if (appointmentError || !appointment) {
    return NextResponse.json({ message: '対象予約が見つかりません。' }, { status: 404 })
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

  const existingPayment = await findPaymentByAppointment(supabase, storeId, appointmentId)
  if (existingPayment) {
    return NextResponse.json({ message: 'この予約にはすでに会計が登録されています。' }, { status: 409 })
  }

  const menus = await fetchAppointmentMenus(supabase, storeId, appointmentId)
  const totals = calculatePaymentTotals(menus)
  const discountAmount = parseNonNegativeInt(body.discount_amount, 0)
  const amountJpy = Math.max(0, Math.round(totals.total) - discountAmount)
  if (amountJpy <= 0) {
    return NextResponse.json({ message: '決済対象金額が0円のため開始できません。' }, { status: 400 })
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
  const successUrl =
    provider === 'stripe'
      ? `${origin}/payments?provider=stripe&status=success&session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/payments?provider=komoju&status=success`
  const cancelUrl = `${origin}/payments?provider=${provider}&status=cancel`
  const metadata = {
    operation_type: 'appointment_payment',
    appointment_id: appointmentId,
    amount_jpy: String(amountJpy),
    discount_amount_jpy: String(discountAmount),
  }

  const session =
    provider === 'stripe'
      ? await createStripeOneTimeCheckoutSession({
          customerId: providerCustomerId,
          successUrl,
          cancelUrl,
          amountJpy,
          itemName: '通常会計',
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
          itemName: '通常会計',
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
