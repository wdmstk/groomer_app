import Link from 'next/link'
import ServiceMenusPageContent from '@/components/page-contents/ServiceMenusPageContent'
import HotelPageContent from '@/components/page-contents/HotelPageContent'
import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'

type RawSearchParams = Record<string, string | string[] | undefined>
type MenuManagementPageProps = {
  searchParams?: Promise<RawSearchParams>
}
type MenuManagementTab = 'trimming' | 'hotel'

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined, hotelOptionEnabled: boolean): MenuManagementTab {
  if (value === 'hotel' && hotelOptionEnabled) return 'hotel'
  return 'trimming'
}

export default async function MenuManagementPage({ searchParams }: MenuManagementPageProps) {
  const params = (await searchParams) ?? {}
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const hotelOptionEnabled = isPlaywrightE2E
    ? true
    : await createStoreScopedClient().then(async ({ supabase, storeId }) => {
        const state = await fetchStorePlanOptionState({
          supabase: asStorePlanOptionsClient(supabase),
          storeId,
        })
        return state.hotelOptionEnabled
      })
  const activeTab = resolveTab(firstParam(params.tab), hotelOptionEnabled)

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">メニュー管理</h1>
        <p className="mt-1 text-sm text-gray-600">トリミングメニューとホテルメニューをタブで切り替えて運用します。</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            <Link
              href="/menu-management?tab=trimming"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'trimming'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              トリミングメニュー
            </Link>
            {hotelOptionEnabled ? (
              <Link
                href="/menu-management?tab=hotel"
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'hotel'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                ホテルメニュー
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      {activeTab === 'trimming' ? (
        <ServiceMenusPageContent searchParams={Promise.resolve({ hide_title: '1' })} />
      ) : (
        <HotelPageContent
          searchParams={Promise.resolve({
            tab: 'menus',
            visible_tabs: 'menus',
            menus_label: 'ホテルメニュー',
            hide_header: '1',
            hide_tabs: '1',
            hide_menus_header: '1',
          })}
        />
      )}
    </section>
  )
}
