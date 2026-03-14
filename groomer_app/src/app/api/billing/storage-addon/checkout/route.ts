import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  createBillingCheckoutSessionLog,
  findLatestBillingSubscriptionByStoreAndProvider,
  findReusableCheckoutSession,
  findBillingCustomer,
  insertBillingOperation,
  upsertBillingSubscription,
  upsertBillingCustomer,
} from '@/lib/billing/db'
import {
  createKomojuStorageAddonCheckoutSession,
  createProviderCustomer,
  createStripeStorageAddonCheckoutSession,
} from '@/lib/billing/providers'
import {
  amountForStorageAddonUnits,
  STORAGE_ADDON_UNIT_GB,
} from '@/lib/billing/pricing'
import { asObject } from '@/lib/object-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown): ProviderType {
  return value === 'komoju' ? 'komoju' : 'stripe'
}

function parseUnits(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.floor(value))
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return Math.max(1, parsed)
  }
  return 1
}

export async function POST(request: Request) {
  try {
    const guard = await requireOwnerStoreMembership()
    if (!guard.ok) {
      return NextResponse.json({ message: guard.message }, { status: guard.status })
    }
    const { storeId, user } = guard

    const bodyRaw: unknown = await request.json().catch(() => null)
    const body = asObject(bodyRaw)
    const provider = parseProvider(body.provider)
    const idempotencyKey =
      request.headers.get('x-idempotency-key') ??
      `${new Date().toISOString().slice(0, 16)}:${storeId}:${user.id}:${provider}:storage-addon`
    const units = parseUnits(body.units)
    const addonGb = units * STORAGE_ADDON_UNIT_GB
    const amountJpy = amountForStorageAddonUnits(units)
    const returnUrlRaw = typeof body.return_url === 'string' ? body.return_url : ''
    const origin = new URL(request.url).origin
    const successUrl = `${origin}/billing/success?provider=${provider}&mode=storage-addon`
    const cancelUrl = `${origin}/settings/storage`
    const returnUrl = returnUrlRaw.trim() || successUrl
    const email = user.email ?? ''
    if (!email) {
      return NextResponse.json({ message: 'User email is required.' }, { status: 400 })
    }

    const reusable = await findReusableCheckoutSession({
      storeId,
      userId: user.id,
      provider,
      subscriptionScope: 'storage_addon',
    })
    if (reusable?.checkout_url) {
      return NextResponse.json({
        checkout_url: reusable.checkout_url,
        session_id: reusable.checkout_session_id,
        reused: true,
      })
    }

    const existingStorageSubscription = await findLatestBillingSubscriptionByStoreAndProvider({
      storeId,
      provider,
      subscriptionScope: 'storage_addon',
    })
    if (
      existingStorageSubscription?.provider_subscription_id &&
      ['trialing', 'active', 'past_due'].includes(existingStorageSubscription.status)
    ) {
      return NextResponse.json(
        {
          message:
            '既存の容量追加契約が有効です。変更時は先に解約または切替対応を行ってください。',
        },
        { status: 409 }
      )
    }

    const existingCustomer = await findBillingCustomer({ storeId, userId: user.id, provider })
    const providerCustomerId =
      existingCustomer?.provider_customer_id ??
      (await createProviderCustomer({
        provider,
        email,
        storeId,
        userId: user.id,
      }))

    const billingCustomer = await upsertBillingCustomer({
      storeId,
      userId: user.id,
      provider,
      providerCustomerId,
      email,
    })

    const session =
      provider === 'stripe'
        ? await createStripeStorageAddonCheckoutSession({
            customerId: providerCustomerId,
            successUrl,
            cancelUrl,
            storeId,
            userId: user.id,
            addonGb,
            amountJpy,
            units,
          })
        : await createKomojuStorageAddonCheckoutSession({
            customerId: providerCustomerId,
            returnUrl,
            storeId,
            userId: user.id,
            addonGb,
            amountJpy,
            units,
          })

    await upsertBillingSubscription({
      storeId,
      provider,
      billingCustomerId: billingCustomer.id,
      providerSubscriptionId: session.subscription ?? null,
      subscriptionScope: 'storage_addon',
      storageAddonUnits: units,
      status: 'incomplete',
      trialEnd: null,
    })

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await createBillingCheckoutSessionLog({
      storeId,
      userId: user.id,
      provider,
      subscriptionScope: 'storage_addon',
      idempotencyKey,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      expiresAt,
    })

    await insertBillingOperation({
      storeId,
      provider,
      providerSubscriptionId: session.subscription ?? null,
      operationType: 'storage_addon_request',
      amountJpy,
      reason: `owner_requested_storage_addon_subscription_${addonGb}gb`,
      status: 'requested',
      resultMessage: `checkout_session_id=${session.id}`,
    })

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
      addon_gb: addonGb,
      amount_jpy: amountJpy,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start storage add-on checkout.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
