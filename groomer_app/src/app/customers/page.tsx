import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createStoreScopedClient } from '@/lib/supabase/store'
import {
  fetchCustomerLtvSummaries,
  getCustomerLtvRankLabel,
  getCustomerLtvRankTone,
  type CustomerLtvSummaryReader,
  type CustomerLtvSummaryRow,
} from '@/lib/customer-ltv'
import { CustomerMemberPortalControls } from '@/components/customers/CustomerMemberPortalControls'
import { customersPageFixtures } from '@/lib/e2e/customers-page-fixtures'
import {
  formatCustomerFallback,
  formatCustomerNoShowCount,
  formatCustomerTags,
  getCustomerLineStatus,
} from '@/lib/customers/presentation'

const RevisitAlertList = nextDynamic(
  () => import('@/components/customers/RevisitAlertList').then((mod) => mod.RevisitAlertList),
  {
    loading: () => <p className="text-sm text-gray-500">来店周期アラートを読み込み中...</p>,
  }
)

const CustomerCreateModal = nextDynamic(
  () => import('@/components/customers/CustomerCreateModal').then((mod) => mod.CustomerCreateModal)
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Customer = {
  id: string
  full_name: string
  phone_number: string | null
  email: string | null
  address: string | null
  line_id: string | null
  how_to_know: string | null
  tags: string[] | null
}

function renderLineStatus(customer: Customer) {
  const status = getCustomerLineStatus(customer.line_id)
  if (status.linked) {
    return (
      <div className="space-y-1">
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          {status.badgeLabel}
        </span>
        <p className="text-xs text-gray-500">{status.detail}</p>
      </div>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
      {status.badgeLabel}
    </span>
  )
}

type PetOption = {
  id: string
  name: string
  customer_id: string
}

type StaffOption = {
  id: string
  full_name: string
}

type MemberPortalLink = {
  id: string
  customer_id: string
  expires_at: string
  last_used_at: string | null
}

function formatCurrency(value: number | null | undefined) {
  return Math.round(value ?? 0).toLocaleString()
}

type CustomersPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
    waitlist_customer?: string
  }>
}

const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab =
    resolvedSearchParams?.tab === 'alerts'
      ? 'alerts'
      : 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const waitlistCustomerId = resolvedSearchParams?.waitlist_customer
  const isWaitlistModalOpen = resolvedSearchParams?.modal === 'waitlist' && Boolean(waitlistCustomerId)
  const needsListSupportData = activeTab === 'list' || isCreateModalOpen || Boolean(editId) || isWaitlistModalOpen
  const modalCloseRedirect = `/customers?tab=${activeTab}`
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: customersPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>
  const adminSupabase = !isPlaywrightE2E && needsListSupportData ? createAdminSupabaseClient() : null
  const data = isPlaywrightE2E
    ? customersPageFixtures.customers
    : (
        await db
          .from('customers')
          .select('id, full_name, phone_number, email, address, line_id, how_to_know, tags')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data
  const customers = (data as Customer[]) ?? []
  const { data: petRows } =
    isWaitlistModalOpen && !isPlaywrightE2E
      ? await db
          .from('pets')
          .select('id, name, customer_id')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      : { data: [] }
  const { data: staffRows } =
    isWaitlistModalOpen && !isPlaywrightE2E
      ? await db
          .from('staffs')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      : { data: [] }
  const appointmentRows = needsListSupportData
    ? isPlaywrightE2E
      ? customersPageFixtures.appointments
      : (
          await db
            .from('appointments')
            .select('customer_id')
            .eq('store_id', storeId)
            .eq('status', '無断キャンセル')
        ).data ?? []
    : []
  const customerLtvRows =
    needsListSupportData && !isPlaywrightE2E
      ? await fetchCustomerLtvSummaries({ supabase: db as unknown as CustomerLtvSummaryReader, storeId })
      : []
  const { data: memberPortalRows } =
    needsListSupportData && adminSupabase
      ? await adminSupabase
          .from('member_portal_links')
          .select('id, customer_id, expires_at, last_used_at')
          .eq('store_id', storeId)
          .eq('purpose', 'member_portal')
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
      : { data: isPlaywrightE2E ? customersPageFixtures.memberPortalLinks : [] }
  const editCustomer = needsListSupportData && editId && !isPlaywrightE2E
    ? (
        (await db
          .from('customers')
          .select('id, full_name, phone_number, email, address, line_id, how_to_know, tags')
          .eq('id', editId)
          .eq('store_id', storeId)
          .single()) as { data: Customer | null }
      ).data
    : null
  const noShowCounts = ((appointmentRows ?? []) as Array<{ customer_id: string | null }>).reduce(
    (acc, row) => {
      if (row.customer_id) {
        acc[row.customer_id] = (acc[row.customer_id] ?? 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )
  const pets = (petRows as PetOption[]) ?? []
  const staffs = (staffRows as StaffOption[]) ?? []
  const customerLtvByCustomerId = new Map<string, CustomerLtvSummaryRow>()
  ;((customerLtvRows as CustomerLtvSummaryRow[] | null) ?? []).forEach((row) => {
    if (!row.customer_id || customerLtvByCustomerId.has(row.customer_id)) return
    customerLtvByCustomerId.set(row.customer_id, row)
  })
  const activeMemberPortalByCustomerId = new Map<string, MemberPortalLink>()
  ;((memberPortalRows as MemberPortalLink[] | null) ?? []).forEach((row) => {
    if (activeMemberPortalByCustomerId.has(row.customer_id)) return
    activeMemberPortalByCustomerId.set(row.customer_id, row)
  })
  const waitlistCustomer = waitlistCustomerId
    ? customers.find((customer) => customer.id === waitlistCustomerId) ?? null
    : null
  const waitlistPets = waitlistCustomer
    ? pets.filter((pet) => pet.customer_id === waitlistCustomer.id)
    : []

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">顧客管理</h1>
      </div>

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/customers?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          顧客一覧
        </Link>
        <Link
          href="/customers?tab=alerts"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'alerts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          来店周期アラート
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">顧客一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {customers.length} 件</p>
              <Link
                href="/customers?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">顧客がまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden" data-testid="customers-list-mobile">
                {customers.map((customer: Customer) => {
                  const customerLtv = customerLtvByCustomerId.get(customer.id)
                  return (
                  <article
                    key={customer.id}
                    className="rounded border p-3 text-sm text-gray-700"
                    data-testid={`customer-row-${customer.id}`}
                  >
                    <p className="font-semibold text-gray-900">
                      {customer.full_name}
                      {formatCustomerNoShowCount(noShowCounts[customer.id] ?? 0) ? (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                          {formatCustomerNoShowCount(noShowCounts[customer.id] ?? 0)}
                        </span>
                      ) : null}
                    </p>
                    <p>電話番号: {formatCustomerFallback(customer.phone_number)}</p>
                    <p>メール: {formatCustomerFallback(customer.email)}</p>
                    <p>住所: {formatCustomerFallback(customer.address)}</p>
                    <div className="flex items-center gap-2">
                      <span>LINE:</span>
                      {renderLineStatus(customer)}
                    </div>
                    <p>来店経路: {formatCustomerFallback(customer.how_to_know)}</p>
                    <p>
                      LTVランク:{' '}
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          getCustomerLtvRankTone(customerLtv?.ltv_rank)
                        }`}
                      >
                        {getCustomerLtvRankLabel(customerLtv?.ltv_rank)}
                      </span>
                    </p>
                    <p>年間売上: {formatCurrency(customerLtv?.annual_sales)}円</p>
                    <p>来店回数: {customerLtv?.visit_count ?? 0}回</p>
                    <p>平均単価: {formatCurrency(customerLtv?.average_spend)}円</p>
                    <p>オプション利用率: {customerLtv?.option_usage_rate ?? 0}%</p>
                    <p>タグ: {formatCustomerTags(customer.tags)}</p>
                    <div className="mt-2">
                      <CustomerMemberPortalControls
                        customerId={customer.id}
                        customerName={customer.full_name}
                        activeExpiresAt={activeMemberPortalByCustomerId.get(customer.id)?.expires_at ?? null}
                        lastUsedAt={activeMemberPortalByCustomerId.get(customer.id)?.last_used_at ?? null}
                        compact
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/customers?tab=list&edit=${customer.id}`}
                        className="text-blue-600 text-sm"
                      >
                        編集
                      </Link>
                      <Link
                        href={`/customers?tab=list&modal=waitlist&waitlist_customer=${customer.id}`}
                        className="text-emerald-700 text-sm"
                      >
                        空き枠待ち
                      </Link>
                      <form action={`/api/customers/${customer.id}`} method="post">
                        <input type="hidden" name="_method" value="delete" />
                        <Button type="submit" className="bg-red-500 hover:bg-red-600">
                          削除
                        </Button>
                      </form>
                    </div>
                  </article>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm text-left" data-testid="customers-list">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2 px-2">氏名</th>
                      <th className="py-2 px-2">電話番号</th>
                      <th className="py-2 px-2">メール</th>
                      <th className="py-2 px-2">住所</th>
                      <th className="py-2 px-2">LINE ID</th>
                      <th className="py-2 px-2">来店経路</th>
                      <th className="py-2 px-2">LTV</th>
                      <th className="py-2 px-2">年間売上</th>
                      <th className="py-2 px-2">来店回数</th>
                      <th className="py-2 px-2">平均単価</th>
                      <th className="py-2 px-2">オプション利用率</th>
                      <th className="py-2 px-2">タグ</th>
                      <th className="py-2 px-2">会員証</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((customer: Customer) => {
                      const customerLtv = customerLtvByCustomerId.get(customer.id)
                      return (
                      <tr
                        key={customer.id}
                        className="text-gray-700"
                        data-testid={`customer-row-${customer.id}`}
                      >
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {customer.full_name}
                          {formatCustomerNoShowCount(noShowCounts[customer.id] ?? 0) ? (
                            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                              {formatCustomerNoShowCount(noShowCounts[customer.id] ?? 0)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-2">{formatCustomerFallback(customer.phone_number)}</td>
                        <td className="py-3 px-2">{formatCustomerFallback(customer.email)}</td>
                        <td className="py-3 px-2">{formatCustomerFallback(customer.address)}</td>
                        <td className="py-3 px-2">{renderLineStatus(customer)}</td>
                        <td className="py-3 px-2">{formatCustomerFallback(customer.how_to_know)}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              getCustomerLtvRankTone(customerLtv?.ltv_rank)
                            }`}
                          >
                            {getCustomerLtvRankLabel(customerLtv?.ltv_rank)}
                          </span>
                        </td>
                        <td className="py-3 px-2">{formatCurrency(customerLtv?.annual_sales)} 円</td>
                        <td className="py-3 px-2">{customerLtv?.visit_count ?? 0} 回</td>
                        <td className="py-3 px-2">{formatCurrency(customerLtv?.average_spend)} 円</td>
                        <td className="py-3 px-2">{customerLtv?.option_usage_rate ?? 0}%</td>
                        <td className="py-3 px-2">{formatCustomerTags(customer.tags)}</td>
                        <td className="py-3 px-2 align-top">
                          <CustomerMemberPortalControls
                            customerId={customer.id}
                            customerName={customer.full_name}
                            activeExpiresAt={activeMemberPortalByCustomerId.get(customer.id)?.expires_at ?? null}
                            lastUsedAt={activeMemberPortalByCustomerId.get(customer.id)?.last_used_at ?? null}
                            compact
                          />
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/customers?tab=list&edit=${customer.id}`}
                              className="text-blue-600 text-sm"
                            >
                              編集
                            </Link>
                            <Link
                              href={`/customers?tab=list&modal=waitlist&waitlist_customer=${customer.id}`}
                              className="text-emerald-700 text-sm"
                            >
                              空き枠待ち
                            </Link>
                            <form action={`/api/customers/${customer.id}`} method="post">
                              <input type="hidden" name="_method" value="delete" />
                              <Button type="submit" className="bg-red-500 hover:bg-red-600">
                                削除
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="space-y-3">
          <RevisitAlertList />
        </Card>
      )}

      {isCreateModalOpen || editCustomer ? (
        <CustomerCreateModal
          title={editCustomer ? '顧客情報の更新' : '新規顧客登録'}
          closeRedirectTo={modalCloseRedirect}
        >
          <form
            action={editCustomer ? `/api/customers/${editCustomer.id}` : '/api/customers'}
            method="post"
            className="space-y-4"
          >
            {editCustomer && <input type="hidden" name="_method" value="put" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2 text-sm text-gray-700">
              氏名
              <Input
                name="full_name"
                required
                defaultValue={editCustomer?.full_name ?? ''}
                placeholder="山田 花子"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              電話番号
              <Input
                name="phone_number"
                defaultValue={editCustomer?.phone_number ?? ''}
                placeholder="090-0000-0000"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              メールアドレス
              <Input
                type="email"
                name="email"
                defaultValue={editCustomer?.email ?? ''}
                placeholder="example@email.com"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              住所
              <Input
                name="address"
                defaultValue={editCustomer?.address ?? ''}
                placeholder="東京都渋谷区..."
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              LINE ID
              <Input
                name="line_id"
                defaultValue={editCustomer?.line_id ?? ''}
                placeholder="@lineid"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              来店経路
              <Input
                name="how_to_know"
                defaultValue={editCustomer?.how_to_know ?? ''}
                placeholder="Instagram, 口コミなど"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              タグ (カンマ区切り)
              <Input
                name="tags"
                defaultValue={editCustomer?.tags?.join(', ') ?? ''}
                placeholder="噛む, 皮膚弱い"
              />
            </label>
            </div>
            {editCustomer ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-semibold text-amber-900">会員証URL</p>
                <CustomerMemberPortalControls
                  customerId={editCustomer.id}
                  customerName={editCustomer.full_name}
                  activeExpiresAt={activeMemberPortalByCustomerId.get(editCustomer.id)?.expires_at ?? null}
                  lastUsedAt={activeMemberPortalByCustomerId.get(editCustomer.id)?.last_used_at ?? null}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="submit">{editCustomer ? '更新する' : '登録する'}</Button>
              {editCustomer && (
                <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                  編集をやめる
                </Link>
              )}
            </div>
          </form>
        </CustomerCreateModal>
      ) : null}

      {resolvedSearchParams?.modal === 'waitlist' && waitlistCustomer ? (
        <CustomerCreateModal
          title="キャンセル枠 waitlist 登録"
          closeRedirectTo={modalCloseRedirect}
        >
          <form action="/api/reoffers/waitlists" method="post" className="space-y-4">
            <input type="hidden" name="customer_id" value={waitlistCustomer.id} />
            <input type="hidden" name="redirect_to" value={modalCloseRedirect} />
            <div className="rounded border bg-sky-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{waitlistCustomer.full_name}</p>
              <p>
                電話: {waitlistCustomer.phone_number ?? '未登録'} / LINE: {waitlistCustomer.line_id ?? '未登録'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                ペット
                <select
                  name="pet_id"
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue={waitlistPets[0]?.id ?? ''}
                >
                  <option value="">未指定</option>
                  {waitlistPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望メニュー
                <Input name="preferred_menu" placeholder="シャンプー" />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望担当
                <select
                  name="preferred_staff_id"
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue=""
                >
                  <option value="">未指定</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                連絡方法
                <select
                  name="channel"
                  defaultValue={waitlistCustomer.line_id ? 'line' : waitlistCustomer.phone_number ? 'phone' : 'manual'}
                  className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="manual">手動</option>
                  <option value="line">LINE</option>
                  <option value="phone">電話</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望開始
                <Input type="datetime-local" name="desired_from" />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                希望終了
                <Input type="datetime-local" name="desired_to" />
              </label>
            </div>
            <label className="space-y-2 text-sm text-gray-700">
              メモ
              <Input name="notes" placeholder="木曜午前の空き枠優先" />
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit">waitlist を登録</Button>
              <Link href={modalCloseRedirect} className="text-sm text-gray-500">
                閉じる
              </Link>
            </div>
          </form>
        </CustomerCreateModal>
      ) : null}
    </section>
  )
}
