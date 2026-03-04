import { NextResponse } from 'next/server'
import { createProviderCustomer, createStripeCheckoutSession } from '@/lib/billing/providers'
import {
  createBillingCheckoutSessionLog,
  findBillingCustomer,
  findReusableCheckoutSession,
  upsertBillingCustomer,
  upsertBillingSubscription,
  updateStoreSubscriptionStatus,
} from '@/lib/billing/db'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const guard = await requireOwnerStoreMembership()
    if (!guard.ok) {
      return NextResponse.json({ message: guard.message }, { status: guard.status })
    }
    const { storeId, user } = guard
    const idempotencyKey =
      request.headers.get('x-idempotency-key') ??
      `${new Date().toISOString().slice(0, 16)}:${storeId}:${user.id}:stripe`

    const reusable = await findReusableCheckoutSession({
      storeId,
      userId: user.id,
      provider: 'stripe',
    })
    if (reusable?.checkout_url) {
      return NextResponse.json({
        checkout_url: reusable.checkout_url,
        session_id: reusable.checkout_session_id,
        reused: true,
      })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const returnUrlRaw = typeof body.return_url === 'string' ? body.return_url : ''
    const origin = new URL(request.url).origin
    const successUrl =
      returnUrlRaw.trim() || `${origin}/billing/success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/billing-required`
    const email = user.email ?? ''
    if (!email) {
      return NextResponse.json({ message: 'User email is required.' }, { status: 400 })
    }

    const existingCustomer = await findBillingCustomer({ storeId, userId: user.id, provider: 'stripe' })
    const providerCustomerId =
      existingCustomer?.provider_customer_id ??
      (await createProviderCustomer({
        provider: 'stripe',
        email,
        storeId,
        userId: user.id,
      }))
    const billingCustomer = await upsertBillingCustomer({
      storeId,
      userId: user.id,
      provider: 'stripe',
      providerCustomerId,
      email,
    })

    const session = await createStripeCheckoutSession({
      customerId: providerCustomerId,
      successUrl,
      cancelUrl,
    })

    await upsertBillingSubscription({
      storeId,
      provider: 'stripe',
      billingCustomerId: billingCustomer.id,
      providerSubscriptionId: session.subscription ?? null,
      status: 'incomplete',
      trialEnd: null,
    })
    await updateStoreSubscriptionStatus({
      storeId,
      status: 'trialing',
      provider: 'stripe',
      source: 'checkout',
      reason: 'start_stripe_checkout',
    })
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await createBillingCheckoutSessionLog({
      storeId,
      userId: user.id,
      provider: 'stripe',
      idempotencyKey,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      expiresAt,
    })

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Stripe Checkout.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
