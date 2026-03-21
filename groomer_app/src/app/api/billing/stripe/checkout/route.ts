import { NextResponse } from 'next/server'
import { createProviderCustomer, createStripeCheckoutSession } from '@/lib/billing/providers'
import {
  countActiveOwnerStores,
  createBillingCheckoutSessionLog,
  findBillingCustomer,
  findLatestBillingSubscriptionByStoreAndProvider,
  findReusableCheckoutSession,
  upsertBillingCustomer,
  upsertBillingSubscription,
} from '@/lib/billing/db'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  amountForPlanWithStoreCountAndOptions,
  parseAiPlanCode,
  parseBillingCycle,
  parsePlanCode,
} from '@/lib/billing/pricing'
import { canPurchaseOptionsByPlan } from '@/lib/subscription-plan'
import { asObject } from '@/lib/object-utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type StoreSubscriptionReader = Pick<SupabaseClient<Database>, 'from'>

async function fetchSubscriptionOptionsWithAiFallback(
  supabase: StoreSubscriptionReader,
  storeId: string
) {
  const withAi = await supabase
    .from('store_subscriptions')
    .select(
      'hotel_option_requested, hotel_option_enabled, notification_option_requested, notification_option_enabled, ai_plan_code_requested, ai_plan_code'
    )
    .eq('store_id', storeId)
    .maybeSingle()
  if (!withAi.error) return withAi.data

  const fallback = await supabase
    .from('store_subscriptions')
    .select('hotel_option_enabled, notification_option_enabled')
    .eq('store_id', storeId)
    .maybeSingle()
  return fallback.data
}

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

    const bodyRaw: unknown = await request.json().catch(() => null)
    const body = asObject(bodyRaw)
    const returnUrlRaw = typeof body.return_url === 'string' ? body.return_url : ''
    const planCode = parsePlanCode(body.plan_code)
    const billingCycle = parseBillingCycle(body.billing_cycle)
    const subscriptionRow = await fetchSubscriptionOptionsWithAiFallback(guard.supabase, storeId)
    const subscriptionOptions = subscriptionRow as {
      hotel_option_requested?: boolean | null
      hotel_option_enabled?: boolean | null
      notification_option_requested?: boolean | null
      notification_option_enabled?: boolean | null
      ai_plan_code_requested?: string | null
      ai_plan_code?: string | null
    } | null
    const optionContractAllowed = canPurchaseOptionsByPlan(planCode)
    const options = {
      hotelOptionEnabled:
        optionContractAllowed &&
        ((subscriptionOptions?.hotel_option_requested ?? subscriptionOptions?.hotel_option_enabled ?? false) === true),
      notificationOptionEnabled:
        optionContractAllowed &&
        ((subscriptionOptions?.notification_option_requested ?? subscriptionOptions?.notification_option_enabled ?? false) === true),
      aiPlanCode:
        optionContractAllowed
          ? parseAiPlanCode(subscriptionOptions?.ai_plan_code_requested ?? subscriptionOptions?.ai_plan_code ?? 'none')
          : 'none',
    }
    const ownerActiveStoreCount = await countActiveOwnerStores(user.id)
    const useAdditionalStorePricing = ownerActiveStoreCount > 1
    const amountJpy = amountForPlanWithStoreCountAndOptions(
      planCode,
      billingCycle,
      ownerActiveStoreCount,
      options
    )
    const latestSubscription = await findLatestBillingSubscriptionByStoreAndProvider({
      storeId,
      provider: 'stripe',
    })
    if (
      latestSubscription?.provider_subscription_id &&
      ['trialing', 'active', 'past_due'].includes(latestSubscription.status)
    ) {
      return NextResponse.json(
        {
          message:
            '既存のStripe契約が有効です。プラン変更時は先に「運用操作」から解約手続きを実行してください。',
        },
        { status: 409 }
      )
    }
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
      plan: planCode,
      billingCycle,
      storeId,
      userId: user.id,
      amountJpy,
      useAdditionalStorePricing,
      options,
    })

    await upsertBillingSubscription({
      storeId,
      provider: 'stripe',
      billingCustomerId: billingCustomer.id,
      providerSubscriptionId: session.subscription ?? null,
      status: 'incomplete',
      trialEnd: null,
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
