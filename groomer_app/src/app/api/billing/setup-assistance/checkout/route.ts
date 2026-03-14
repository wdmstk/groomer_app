import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  findBillingCustomer,
  insertBillingOperation,
  upsertBillingCustomer,
} from '@/lib/billing/db'
import {
  createKomojuOneTimeCheckoutSession,
  createProviderCustomer,
  createStripeOneTimeCheckoutSession,
} from '@/lib/billing/providers'
import { SETUP_ASSISTANCE_FEE_JPY } from '@/lib/billing/pricing'
import { asObject } from '@/lib/object-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProviderType = 'stripe' | 'komoju'

function parseProvider(value: unknown): ProviderType {
  return value === 'komoju' ? 'komoju' : 'stripe'
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
    const returnUrlRaw = typeof body.return_url === 'string' ? body.return_url : ''
    const origin = new URL(request.url).origin
    const successUrl = `${origin}/billing/success?provider=${provider}&mode=setup-assistance`
    const cancelUrl = `${origin}/billing`
    const returnUrl = returnUrlRaw.trim() || successUrl
    const email = user.email ?? ''
    if (!email) {
      return NextResponse.json({ message: 'User email is required.' }, { status: 400 })
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

    await upsertBillingCustomer({
      storeId,
      userId: user.id,
      provider,
      providerCustomerId,
      email,
    })

    const operationAmount = SETUP_ASSISTANCE_FEE_JPY
    const itemName = '初期設定代行オプション'
    const session =
      provider === 'stripe'
        ? await createStripeOneTimeCheckoutSession({
            customerId: providerCustomerId,
            successUrl,
            cancelUrl,
            amountJpy: operationAmount,
            itemName,
            storeId,
            userId: user.id,
          })
        : await createKomojuOneTimeCheckoutSession({
            customerId: providerCustomerId,
            returnUrl,
            amountJpy: operationAmount,
            itemName,
            storeId,
            userId: user.id,
          })

    await insertBillingOperation({
      storeId,
      provider,
      operationType: 'setup_assistance_request',
      amountJpy: operationAmount,
      reason: 'owner_requested_setup_assistance_checkout',
      status: 'requested',
      resultMessage: `checkout_session_id=${session.id}`,
    })

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start setup assistance checkout.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
