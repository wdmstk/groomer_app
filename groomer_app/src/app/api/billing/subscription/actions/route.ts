import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  findLatestBillingSubscriptionByStoreAndProvider,
  insertBillingOperation,
  updateStoreSubscriptionStatus,
  updateSubscriptionStatusByProviderSubscriptionId,
} from '@/lib/billing/db'
import { cancelKomojuSubscription, cancelStripeSubscription } from '@/lib/billing/providers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ActionType = 'cancel_immediately' | 'cancel_at_period_end' | 'refund_request'
type ProviderType = 'stripe' | 'komoju'
const ALLOWED_ACTIONS = new Set<ActionType>(['cancel_immediately', 'cancel_at_period_end', 'refund_request'])
const ALLOWED_PROVIDERS = new Set<ProviderType>(['stripe', 'komoju'])

function isProviderType(value: string): value is ProviderType {
  return ALLOWED_PROVIDERS.has(value as ProviderType)
}

function isActionType(value: string): value is ActionType {
  return ALLOWED_ACTIONS.has(value as ActionType)
}

export async function POST(request: Request) {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const providerRaw = typeof body?.provider === 'string' ? body.provider.trim() : ''
  const actionRaw = typeof body?.action === 'string' ? body.action.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : null
  const amountRaw = typeof body?.amount_jpy === 'number' ? body.amount_jpy : null
  const amountJpy = Number.isFinite(amountRaw) && amountRaw !== null ? Math.max(0, Math.round(amountRaw)) : null

  if (!isProviderType(providerRaw)) {
    return NextResponse.json({ message: 'provider must be stripe or komoju.' }, { status: 400 })
  }
  if (!isActionType(actionRaw)) {
    return NextResponse.json({ message: 'invalid action.' }, { status: 400 })
  }
  const provider = providerRaw
  const action = actionRaw

  const target = await findLatestBillingSubscriptionByStoreAndProvider({
    storeId: guard.storeId,
    provider,
  })
  if (!target?.provider_subscription_id) {
    return NextResponse.json({ message: '対象サブスクが見つかりません。' }, { status: 404 })
  }

  if (action === 'refund_request') {
    await insertBillingOperation({
      storeId: guard.storeId,
      provider,
      providerSubscriptionId: target.provider_subscription_id,
      operationType: 'refund_request',
      amountJpy,
      reason,
      status: 'requested',
      resultMessage: 'Refund request logged. Handle on provider console.',
    })
    return NextResponse.json({ message: '返金依頼を記録しました。' })
  }

  try {
    if (provider === 'stripe') {
      await cancelStripeSubscription({
        subscriptionId: target.provider_subscription_id,
        immediately: action === 'cancel_immediately',
      })
    } else {
      await cancelKomojuSubscription({
        subscriptionId: target.provider_subscription_id,
        immediately: action === 'cancel_immediately',
      })
    }

    await insertBillingOperation({
      storeId: guard.storeId,
      provider,
      providerSubscriptionId: target.provider_subscription_id,
      operationType: action,
      reason,
      status: 'succeeded',
      resultMessage: 'Provider API call succeeded.',
    })

    if (action === 'cancel_immediately') {
      await updateSubscriptionStatusByProviderSubscriptionId({
        provider,
        providerSubscriptionId: target.provider_subscription_id,
        status: 'canceled',
        source: 'manual',
        reason: 'owner_cancel_immediately',
      })
      await updateStoreSubscriptionStatus({
        storeId: guard.storeId,
        status: 'canceled',
        provider,
        source: 'manual',
        reason: 'owner_cancel_immediately',
      })
      return NextResponse.json({ message: '即時解約を実行しました。' })
    }

    return NextResponse.json({ message: '期間終了時解約を設定しました。' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Operation failed.'
    await insertBillingOperation({
      storeId: guard.storeId,
      provider,
      providerSubscriptionId: target.provider_subscription_id,
      operationType: action,
      reason,
      status: 'failed',
      resultMessage: message,
    })
    return NextResponse.json({ message }, { status: 500 })
  }
}
