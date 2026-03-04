import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { updateStoreSubscriptionStatus } from '@/lib/billing/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_PROVIDERS = new Set(['stripe', 'komoju'])

export async function POST(request: Request) {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  const provider = typeof body?.provider === 'string' ? body.provider.trim() : ''
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ message: 'provider must be stripe or komoju.' }, { status: 400 })
  }

  const { data: current } = await guard.supabase
    .from('store_subscriptions')
    .select('billing_status')
    .eq('store_id', guard.storeId)
    .maybeSingle()
  const currentStatus =
    current?.billing_status && typeof current.billing_status === 'string'
      ? current.billing_status
      : 'trialing'

  await updateStoreSubscriptionStatus({
    storeId: guard.storeId,
    status: (['trialing', 'active', 'past_due', 'canceled', 'paused', 'inactive'].includes(currentStatus)
      ? currentStatus
      : 'trialing') as 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'inactive',
    provider: provider as 'stripe' | 'komoju',
    source: 'manual',
    reason: 'owner_switch_preferred_provider',
  })

  return NextResponse.json({ message: 'preferred_provider updated.' })
}
