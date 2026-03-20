import Link from 'next/link'
import BillingManagementContent from '@/components/billing/pages/BillingManagementContent'
import BillingHistoryContent from '@/components/billing/pages/BillingHistoryContent'

type RawSearchParams = Record<string, string | string[] | undefined>
type BillingTab = 'management' | 'history'

type BillingPageProps = {
  searchParams?: Promise<RawSearchParams>
}

const BILLING_TABS: Array<{ id: BillingTab; label: string }> = [
  { id: 'management', label: '決済管理' },
  { id: 'history', label: '決済履歴' },
]

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined): BillingTab {
  if (value === 'history') return 'history'
  return 'management'
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {}
  const tab = resolveTab(firstParam(params.tab))
  const message = firstParam(params.message)
  const error = firstParam(params.error)

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">決済管理</h1>
        <p className="text-sm text-gray-600">決済管理と決済履歴をタブで管理します。</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2">
        {BILLING_TABS.map((item) => {
          const isActive = tab === item.id
          return (
            <Link
              key={item.id}
              href={`/billing?tab=${item.id}`}
              className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {tab === 'management' ? <BillingManagementContent searchParams={Promise.resolve({ message, error })} /> : null}
      {tab === 'history' ? <BillingHistoryContent /> : null}
    </section>
  )
}
