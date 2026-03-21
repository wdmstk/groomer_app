import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { SubscriptionsManager } from '@/components/dev/SubscriptionsManager'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    message?: string
  }>
}

type StoreRow = {
  id: string
  name: string
  is_active: boolean
}

type SubscriptionRow = {
  store_id: string
  plan_code: string
  ai_plan_code_requested: string | null
  ai_plan_code_effective: string | null
  ai_plan_code: string | null
  hotel_option_requested: boolean | null
  hotel_option_effective: boolean | null
  hotel_option_enabled: boolean | null
  notification_option_requested: boolean | null
  notification_option_effective: boolean | null
  notification_option_enabled: boolean | null
  billing_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'
  billing_cycle: 'monthly' | 'yearly' | 'custom'
  preferred_provider: 'stripe' | 'komoju' | null
  amount_jpy: number
  current_period_start: string | null
  current_period_end: string | null
  next_billing_date: string | null
  trial_days: number | null
  trial_started_at: string | null
  grace_days: number | null
  past_due_since: string | null
  notes: string | null
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function DevSubscriptionsPage({ searchParams }: PageProps) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金管理</h1>
        <Card>
          <p className="text-sm text-red-700">
            このページはサポート管理者のみアクセスできます。
          </p>
        </Card>
      </section>
    )
  }

  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams?.message ?? ''

  const admin = createAdminClient()
  if (!admin) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金管理</h1>
        <Card>
          <p className="text-sm text-red-700">
            NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。
          </p>
        </Card>
      </section>
    )
  }

  const [{ data: stores, error: storesError }, { data: subscriptions, error: subscriptionsError }] =
    await Promise.all([
      admin.from('stores').select('id, name, is_active').order('created_at', { ascending: true }),
      admin.from('store_subscriptions').select(
        'store_id, plan_code, ai_plan_code_requested, ai_plan_code_effective, ai_plan_code, hotel_option_requested, hotel_option_effective, hotel_option_enabled, notification_option_requested, notification_option_effective, notification_option_enabled, billing_status, billing_cycle, preferred_provider, amount_jpy, current_period_start, current_period_end, next_billing_date, trial_days, trial_started_at, grace_days, past_due_since, notes'
      ),
    ])

  if (storesError) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金管理</h1>
        <Card>
          <p className="text-sm text-red-700">店舗一覧の取得に失敗しました: {storesError.message}</p>
        </Card>
      </section>
    )
  }

  if (subscriptionsError) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金管理</h1>
        <Card>
          <p className="text-sm text-red-700">
            store_subscriptions テーブルの取得に失敗しました: {subscriptionsError.message}
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">サブスク課金管理（開発者専用）</h1>
      </div>
      <SubscriptionsManager
        stores={(stores ?? []) as StoreRow[]}
        subscriptions={(subscriptions ?? []) as SubscriptionRow[]}
        message={message}
      />
    </section>
  )
}
