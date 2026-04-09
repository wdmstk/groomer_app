import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import { billingPageFixtures } from '@/lib/e2e/billing-page-fixtures'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

const StorePaymentProviderConnectionsPanel = nextDynamic(
  () =>
    import('@/components/billing/StorePaymentProviderConnectionsPanel').then(
      (mod) => mod.StorePaymentProviderConnectionsPanel
    ),
  {
    loading: () => <p className="text-sm text-gray-500">接続設定を読み込み中...</p>,
  }
)

const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

type ProviderConnectionView = {
  provider: 'stripe' | 'komoju'
  is_active: boolean
  has_secret_key: boolean
  has_webhook_secret: boolean
  komoju_api_base_url: string | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BillingConnectionsContent() {
  const guard = isPlaywrightE2E ? billingPageFixtures.guard : await requireOwnerStoreMembership()
  if (!guard.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">決済接続</h1>
        <Card>
          <p className="text-sm text-red-700">{guard.message}</p>
        </Card>
      </section>
    )
  }

  const { storeId } = guard
  const admin = isPlaywrightE2E ? null : createAdminSupabaseClient()
  const adminClient = admin as NonNullable<typeof admin>

  const providerConnections: ProviderConnectionView[] = isPlaywrightE2E
    ? [
        {
          provider: 'stripe',
          is_active: true,
          has_secret_key: true,
          has_webhook_secret: true,
          komoju_api_base_url: null,
        },
        {
          provider: 'komoju',
          is_active: false,
          has_secret_key: false,
          has_webhook_secret: false,
          komoju_api_base_url: null,
        },
      ]
    : ((
        await adminClient
          .from('store_payment_provider_connections' as never)
          .select('provider, is_active, secret_key, webhook_secret, komoju_api_base_url')
          .eq('store_id', storeId)
      ).data?.map((row) => ({
        provider: (row as { provider: 'stripe' | 'komoju' }).provider,
        is_active: Boolean((row as { is_active: boolean | null }).is_active),
        has_secret_key: Boolean((row as { secret_key: string | null }).secret_key),
        has_webhook_secret: Boolean((row as { webhook_secret: string | null }).webhook_secret),
        komoju_api_base_url: (row as { komoju_api_base_url: string | null }).komoju_api_base_url,
      })) ?? []) as ProviderConnectionView[]

  return (
    <section className="space-y-6">
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Customer Payment Accounts</p>
        <h2 className="text-lg font-semibold text-gray-900">店舗別 顧客決済アカウント接続</h2>
        <div className="mt-4">
          <StorePaymentProviderConnectionsPanel initialConnections={providerConnections} />
        </div>
      </Card>
    </section>
  )
}
