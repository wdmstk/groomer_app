import Link from 'next/link'
import PublicReserveSettingsContent from '@/components/settings/pages/PublicReserveSettingsContent'
import NotificationSettingsContent from '@/components/settings/pages/NotificationSettingsContent'
import StorageSettingsContent from '@/components/settings/pages/StorageSettingsContent'
import SetupStoreContent from '@/components/settings/pages/SetupStoreContent'

type RawSearchParams = Record<string, string | string[] | undefined>
type SettingsTab = 'public-reserve' | 'notifications' | 'storage' | 'setup-store'

type SettingsPageProps = {
  searchParams?: Promise<RawSearchParams>
}

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'public-reserve', label: '公開予約設定' },
  { id: 'notifications', label: '通知設定' },
  { id: 'storage', label: '容量設定' },
  { id: 'setup-store', label: '新しい店舗を追加' },
]

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined): SettingsTab {
  if (value === 'notifications' || value === 'storage' || value === 'setup-store') {
    return value
  }
  return 'public-reserve'
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {}
  const tab = resolveTab(firstParam(params.tab))
  const saved = firstParam(params.saved)
  const error = firstParam(params.error)

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">店舗管理</h1>
        <p className="text-sm text-gray-600">公開予約・通知・容量・店舗追加をタブで管理します。</p>
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

      {tab === 'public-reserve' ? <PublicReserveSettingsContent /> : null}
      {tab === 'notifications' ? (
        <NotificationSettingsContent searchParams={Promise.resolve({ saved, error })} />
      ) : null}
      {tab === 'storage' ? <StorageSettingsContent searchParams={Promise.resolve({ saved, error })} /> : null}
      {tab === 'setup-store' ? <SetupStoreContent /> : null}
    </section>
  )
}
