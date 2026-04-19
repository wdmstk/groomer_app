import Link from 'next/link'
import AppointmentsPageContent from '@/components/page-contents/AppointmentsPageContent'
import HotelPageContent from '@/components/page-contents/HotelPageContent'
import { Card } from '@/components/ui/Card'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { asStorePlanOptionsClient, fetchStorePlanOptionState } from '@/lib/store-plan-options'

type RawSearchParams = Record<string, string | string[] | undefined>
type ReservationManagementPageProps = {
  searchParams?: Promise<RawSearchParams>
}
type ReservationManagementTab = 'calendar' | 'trimmer' | 'hotel'

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveTab(value: string | undefined, hotelOptionEnabled: boolean): ReservationManagementTab {
  if (value === 'calendar') return 'calendar'
  if (value === 'hotel' && hotelOptionEnabled) return 'hotel'
  return 'trimmer'
}

export default async function ReservationManagementPage({ searchParams }: ReservationManagementPageProps) {
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
        <h1 className="text-2xl font-semibold text-gray-900">予約管理</h1>
        <p className="mt-1 text-sm text-gray-600">トリマー予約とホテル予約をタブで切り替えて運用します。</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            <Link
              href="/reservation-management?tab=calendar"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              カレンダー
            </Link>
            <Link
              href="/reservation-management?tab=trimmer"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === 'trimmer'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              トリマー予約
            </Link>
            {hotelOptionEnabled ? (
              <Link
                href="/reservation-management?tab=hotel"
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'hotel'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                ホテル予約
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      {activeTab === 'calendar' ? (
        <AppointmentsPageContent searchParams={Promise.resolve({ tab: 'calendar', hide_header: '1', hide_tabs: '1' })} />
      ) : null}

      {activeTab === 'trimmer' ? (
        <AppointmentsPageContent searchParams={Promise.resolve({ tab: 'list', hide_header: '1', hide_tabs: '1' })} />
      ) : null}

      {activeTab === 'hotel' ? (
        <HotelPageContent
          searchParams={Promise.resolve({
            tab: 'list',
            visible_tabs: 'list',
            hide_header: '1',
            hide_tabs: '1',
            hide_list_header: '1',
            list_visual_style: 'appointments',
          })}
        />
      ) : null}
    </section>
  )
}
