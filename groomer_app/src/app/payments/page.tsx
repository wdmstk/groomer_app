import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  buildPaymentAppointmentLabel,
  formatPaymentPaidAt,
  formatPaymentPaidState,
  getPaymentRelatedValue,
} from '@/lib/payments/presentation'
import { paymentsPageFixtures } from '@/lib/e2e/payments-page-fixtures'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { PaymentCreateModal } from '@/components/payments/PaymentCreateModal'
import { InvoiceCheckoutPanel } from '@/components/payments/InvoiceCheckoutPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AppointmentOption = {
  id: string
  customer_id: string
  start_time: string
  customers?: { full_name: string } | { full_name: string }[] | null
  pets?: { name: string } | { name: string }[] | null
}

type AppointmentMenuSummary = {
  appointment_id: string
  price: number
  tax_rate: number | null
  tax_included: boolean | null
}

type PaymentRow = {
  id: string
  appointment_id: string
  customer_id: string | null
  visit_id: string | null
  status: string
  method: string
  subtotal_amount: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  paid_at: string | null
  notes: string | null
  customers?: { full_name: string } | { full_name: string }[] | null
  appointments?: { id: string } | { id: string }[] | null
}

type CustomerOption = {
  id: string
  full_name: string
}

type PaymentsPageProps = {
  searchParams?: Promise<{
    tab?: string
    modal?: string
    edit?: string
    appointment_id?: string
    mode?: string
  }>
}

const paymentMethodOptions = ['現金', 'カード', '電子マネー', 'QR決済', 'その他']
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isLegacyMode = resolvedSearchParams?.mode === 'legacy' || Boolean(resolvedSearchParams?.appointment_id)
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' && isLegacyMode
  const editId = resolvedSearchParams?.edit
  const prefillAppointmentId = resolvedSearchParams?.appointment_id ?? ''
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: paymentsPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>

  const payments = isPlaywrightE2E
    ? paymentsPageFixtures.payments
    : (
        await db
          .from('payments')
          .select(
            'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, customers(full_name), appointments(id)'
          )
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const appointments = isPlaywrightE2E
    ? paymentsPageFixtures.appointments
    : (
        await db
          .from('appointments')
          .select('id, customer_id, start_time, customers(full_name), pets(name)')
          .eq('store_id', storeId)
          .order('start_time', { ascending: false })
      ).data

  const appointmentMenus = isPlaywrightE2E
    ? paymentsPageFixtures.appointmentMenus
    : (
        await db
          .from('appointment_menus')
          .select('appointment_id, price, tax_rate, tax_included')
          .eq('store_id', storeId)
      ).data

  const customers = isPlaywrightE2E
    ? paymentsPageFixtures.customers
    : (
        await db
          .from('customers')
          .select('id, full_name')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
      ).data

  const editPayment =
    !editId
      ? null
      : isPlaywrightE2E
        ? paymentsPageFixtures.payments.find((payment) => payment.id === editId) ?? null
        : (
            await db
              .from('payments')
              .select(
                'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes'
              )
              .eq('id', editId)
              .eq('store_id', storeId)
              .single()
          ).data

  const paymentList: PaymentRow[] = ((payments ?? []) as PaymentRow[])
  const appointmentOptions: AppointmentOption[] = ((appointments ?? []) as AppointmentOption[])
  const customerOptions: CustomerOption[] = ((customers ?? []) as CustomerOption[])
  const customerNameById = Object.fromEntries(
    customerOptions.map((customer) => [customer.id, customer.full_name])
  )
  const appointmentTotals = new Map<string, { subtotal: number; tax: number; total: number }>()

  ;((appointmentMenus ?? []) as AppointmentMenuSummary[]).forEach((menu) => {
    const current = appointmentTotals.get(menu.appointment_id) ?? {
      subtotal: 0,
      tax: 0,
      total: 0,
    }
    const taxRate = menu.tax_rate ?? 0.1
    const taxIncluded = menu.tax_included ?? true
    const base = taxIncluded ? menu.price / (1 + taxRate) : menu.price
    const tax = taxIncluded ? menu.price - base : menu.price * taxRate
    appointmentTotals.set(menu.appointment_id, {
      subtotal: current.subtotal + base,
      tax: current.tax + tax,
      total: current.total + base + tax,
    })
  })

  const appointmentFormOptions = appointmentOptions.map((appointment) => {
    const totals = appointmentTotals.get(appointment.id) ?? { subtotal: 0, tax: 0, total: 0 }
    return {
      id: appointment.id,
      label: buildPaymentAppointmentLabel({
        id: appointment.id,
        customerId: appointment.customer_id,
        startTime: appointment.start_time,
        customers: appointment.customers,
        pets: appointment.pets,
      }),
      customerId: appointment.customer_id ?? null,
      subtotal: Math.round(totals.subtotal),
      tax: Math.round(totals.tax),
      total: Math.round(totals.total),
    }
  })

  const appointmentLabelById = new Map(
    appointmentFormOptions.map((appointment) => {
      return [appointment.id, appointment.label]
    })
  )
  const occupiedAppointmentIds = new Set(paymentList.map((payment) => payment.appointment_id))
  const selectableAppointmentOptions = appointmentFormOptions.filter(
    (appointment) => appointment.id === (editPayment?.appointment_id ?? null) || !occupiedAppointmentIds.has(appointment.id)
  )
  const modalCloseRedirect = `/payments?tab=${activeTab}`

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">会計管理</h1>
        <p className="text-sm text-gray-600">
          統合請求（トリミング + ホテル）を優先して会計確定できます。予約単位の会計はレガシー導線から利用してください。
        </p>
      </div>

      <InvoiceCheckoutPanel customerNameById={customerNameById} />

      <div className="flex items-center gap-4 border-b">
        <Link
          href="/payments?tab=list"
          className={`pb-2 text-sm font-semibold ${
            activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          会計一覧
        </Link>
      </div>

      {activeTab === 'list' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">会計一覧</h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">全 {paymentList.length} 件</p>
              <Link
                href="/payments?tab=list&modal=create&mode=legacy"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                予約単位会計（レガシー）
              </Link>
            </div>
          </div>
          {paymentList.length === 0 ? (
            <p className="text-sm text-gray-500">会計がまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden" data-testid="payments-list-mobile">
                {paymentList.map((payment) => (
                  <article
                    key={payment.id}
                    className="rounded border p-3 text-sm text-gray-700"
                    data-testid={`payment-row-${payment.id}`}
                  >
                    <p className="font-semibold text-gray-900">
                      {getPaymentRelatedValue(payment.customers, 'full_name')}
                    </p>
                    <p>
                      予約:{' '}
                      {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                    </p>
                    <p>金額: {payment.total_amount.toLocaleString()} 円</p>
                    <p>会計状態: {formatPaymentPaidState(payment.paid_at)}</p>
                    <p>支払方法: {payment.method ?? '現金'}</p>
                    <p>支払日時: {formatPaymentPaidAt(payment.paid_at)}</p>
                    <p>備考: {payment.notes ?? 'なし'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/payments?tab=list&edit=${payment.id}`}
                        className="text-blue-600 text-sm"
                      >
                        編集
                      </Link>
                      {payment.paid_at ? (
                        <Link href={`/receipts/${payment.id}`} className="text-sm text-gray-600">
                          印刷
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">未会計</span>
                      )}
                      <form action={`/api/payments/${payment.id}`} method="post">
                        <input type="hidden" name="_method" value="delete" />
                        <Button type="submit" className="bg-red-500 hover:bg-red-600">
                          削除
                        </Button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm text-left" data-testid="payments-list">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="py-2 px-2">顧客</th>
                      <th className="py-2 px-2">予約</th>
                      <th className="py-2 px-2">合計金額</th>
                      <th className="py-2 px-2">会計状態</th>
                      <th className="py-2 px-2">支払方法</th>
                      <th className="py-2 px-2">支払日時</th>
                      <th className="py-2 px-2">備考</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paymentList.map((payment) => (
                      <tr
                        key={payment.id}
                        className="text-gray-700"
                        data-testid={`payment-row-${payment.id}`}
                      >
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {getPaymentRelatedValue(payment.customers, 'full_name')}
                        </td>
                        <td className="py-3 px-2">
                          {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                        </td>
                        <td className="py-3 px-2">{payment.total_amount.toLocaleString()} 円</td>
                        <td className="py-3 px-2">{formatPaymentPaidState(payment.paid_at)}</td>
                        <td className="py-3 px-2">{payment.method ?? '現金'}</td>
                        <td className="py-3 px-2">{formatPaymentPaidAt(payment.paid_at)}</td>
                        <td className="py-3 px-2">{payment.notes ?? 'なし'}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/payments?tab=list&edit=${payment.id}`}
                              className="text-blue-600 text-sm"
                            >
                              編集
                            </Link>
                            {payment.paid_at ? (
                              <Link
                                href={`/receipts/${payment.id}`}
                                className="text-sm text-gray-600"
                              >
                                印刷
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-400">未会計</span>
                            )}
                            <form action={`/api/payments/${payment.id}`} method="post">
                              <input type="hidden" name="_method" value="delete" />
                              <Button type="submit" className="bg-red-500 hover:bg-red-600">
                                削除
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {isCreateModalOpen || editPayment ? (
        <PaymentCreateModal
          action={editPayment ? `/api/payments/${editPayment.id}` : '/api/payments'}
          isEdit={Boolean(editPayment)}
          initialAppointmentId={editPayment?.appointment_id ?? prefillAppointmentId}
          initialMethod={editPayment?.method ?? '現金'}
          initialDiscountAmount={editPayment?.discount_amount ?? 0}
          initialNotes={editPayment?.notes ?? ''}
          paymentMethodOptions={paymentMethodOptions}
          appointmentOptions={selectableAppointmentOptions}
          customerNameById={customerNameById}
          closeRedirectTo={`${modalCloseRedirect}&mode=legacy`}
        />
      ) : null}
    </section>
  )
}
