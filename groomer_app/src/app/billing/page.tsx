import Link from 'next/link'
import BillingManagementContent from '@/components/billing/pages/BillingManagementContent'
import BillingHistoryContent from '@/components/billing/pages/BillingHistoryContent'
import BillingConnectionsContent from '@/components/billing/pages/BillingConnectionsContent'

type RawSearchParams = Record<string, string | string[] | undefined>
type BillingTab = 'management' | 'history' | 'connections'

type BillingPageProps = {
  searchParams?: Promise<RawSearchParams>
}

const BILLING_TABS: Array<{ id: BillingTab; label: string }> = [
  { id: 'management', label: '決済管理' },
  { id: 'history', label: '決済履歴' },
  { id: 'connections', label: '決済接続' },
]

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined): BillingTab {
  if (value === 'history') return 'history'
  if (value === 'connections') return 'connections'
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">決済管理</h1>
        <p className="text-sm text-gray-600 dark:text-slate-300">決済管理と決済履歴をタブで管理します。</p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        {BILLING_TABS.map((item) => {
          const isActive = tab === item.id
          return (
            <Link
              key={item.id}
              href={`/billing?tab=${item.id}`}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
        </div>
      </div>

      {tab === 'management' ? <BillingManagementContent searchParams={Promise.resolve({ message, error })} /> : null}
      {tab === 'history' ? <BillingHistoryContent /> : null}
      {tab === 'connections' ? <BillingConnectionsContent /> : null}
    </section>
  )
}
