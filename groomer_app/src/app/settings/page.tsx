import Link from 'next/link'
import { redirect } from 'next/navigation'
import PublicReserveSettingsContent from '@/components/settings/pages/PublicReserveSettingsContent'
import StoreOperationsSettingsContent from '@/components/settings/pages/StoreOperationsSettingsContent'
import ConsentTemplateSettingsContent from '@/components/settings/pages/ConsentTemplateSettingsContent'
import NotificationSettingsContent from '@/components/settings/pages/NotificationSettingsContent'
import StorageSettingsContent from '@/components/settings/pages/StorageSettingsContent'
import SetupStoreContent from '@/components/settings/pages/SetupStoreContent'
import { createStoreScopedClient } from '@/lib/supabase/store'

type RawSearchParams = Record<string, string | string[] | undefined>
type SettingsTab =
  | 'store-ops'
  | 'public-reserve'
  | 'consent-templates'
  | 'notifications'
  | 'storage'
  | 'setup-store'
type MembershipRole = 'owner' | 'admin' | 'staff'

type SettingsPageProps = {
  searchParams?: Promise<RawSearchParams>
}

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'store-ops', label: '店舗運用設定' },
  { id: 'public-reserve', label: '公開予約設定' },
  { id: 'consent-templates', label: '電子同意書テンプレ管理' },
  { id: 'notifications', label: '通知設定' },
  { id: 'storage', label: '容量設定' },
  { id: 'setup-store', label: '新しい店舗を追加' },
]

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined): SettingsTab {
  if (
    value === 'store-ops' ||
    value === 'public-reserve' ||
    value === 'consent-templates' ||
    value === 'notifications' ||
    value === 'storage' ||
    value === 'setup-store'
  ) {
    return value
  }
  return 'store-ops'
}

function resolveE2ERole(value: string | undefined): MembershipRole | null {
  if (value === 'owner' || value === 'admin' || value === 'staff') return value
  return null
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {}
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  if (isPlaywrightE2E) {
    const e2eRole = resolveE2ERole(firstParam(params.e2e_role))
    if (e2eRole === 'staff') {
      redirect('/dashboard')
    }
  } else {
    const { supabase, storeId } = await createStoreScopedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const membership = user
      ? (
          await supabase
            .from('store_memberships')
            .select('role')
            .eq('store_id', storeId)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()
        ).data
      : null
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      redirect('/dashboard')
    }
  }

  const tab = resolveTab(firstParam(params.tab))
  const saved = firstParam(params.saved)
  const error = firstParam(params.error)

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">店舗管理</h1>
        <p className="text-sm text-gray-600">
          店舗の運用ルール、公開予約、電子同意書テンプレート、通知、容量管理、新規店舗追加をこの画面で管理します。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2">
        {SETTINGS_TABS.map((item) => {
          const isActive = tab === item.id
          return (
            <Link
              key={item.id}
              href={`/settings?tab=${item.id}`}
              className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {tab === 'store-ops' ? <StoreOperationsSettingsContent /> : null}
      {tab === 'public-reserve' ? <PublicReserveSettingsContent /> : null}
      {tab === 'consent-templates' ? <ConsentTemplateSettingsContent /> : null}
      {tab === 'notifications' ? (
        <NotificationSettingsContent searchParams={Promise.resolve({ saved, error })} />
      ) : null}
      {tab === 'storage' ? <StorageSettingsContent searchParams={Promise.resolve({ saved, error })} /> : null}
      {tab === 'setup-store' ? <SetupStoreContent /> : null}
    </section>
  )
}
