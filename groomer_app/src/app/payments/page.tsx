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
import { PosCheckoutPanel } from '@/components/payments/PosCheckoutPanel'

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
  id?: string
  appointment_id: string
  menu_name?: string | null
  price: number
  tax_rate: number | null
  tax_included: boolean | null
}

type HotelStayForPos = {
  id: string
  appointment_id: string | null
}

type HotelChargeForPos = {
  id: string
  stay_id: string
  label: string
  line_amount_jpy: number
  tax_rate: number
  tax_included: boolean
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

type ProductOption = {
  id: string
  name: string
  unit: string
}

type PosAppointmentOption = {
  id: string
  label: string
  customerId: string | null
}

type PosServiceLineOption = {
  id: string
  appointmentId: string
  label: string
  amount: number
  taxRate: number
  taxIncluded: boolean
}

type PosHotelLineOption = {
  id: string
  appointmentId: string
  label: string
  amount: number
  taxRate: number
  taxIncluded: boolean
}

type PaymentsPageProps = {
  searchParams?: Promise<{
    modal?: string
    edit?: string
    appointment_id?: string
    mode?: string
  }>
}

const paymentMethodOptions = ['現金', 'カード', '電子マネー', 'QR決済', 'その他']
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

function paymentStateClass(paidAt: string | null) {
  if (paidAt) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const resolvedSearchParams = await searchParams
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
          .select('id, appointment_id, menu_name, price, tax_rate, tax_included')
          .eq('store_id', storeId)
      ).data

  const hotelStaysForPos = isPlaywrightE2E
    ? paymentsPageFixtures.hotelStaysForPos
    : (
        await db
          .from('hotel_stays')
          .select('id, appointment_id')
          .eq('store_id', storeId)
          .not('appointment_id', 'is', null)
      ).data

  const hotelChargesForPos = isPlaywrightE2E
    ? paymentsPageFixtures.hotelChargesForPos
    : (
        await db
          .from('hotel_charges')
          .select('id, stay_id, label, line_amount_jpy, tax_rate, tax_included')
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

  const products = isPlaywrightE2E
    ? []
    : (
        await db
          .from('inventory_items')
          .select('id, name, unit')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name', { ascending: true })
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
  const productOptions: ProductOption[] = ((products ?? []) as ProductOption[])
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
  const posAppointmentOptions: PosAppointmentOption[] = appointmentFormOptions.map((appointment) => ({
    id: appointment.id,
    label: appointment.label,
    customerId: appointment.customerId,
  }))
  const posServiceLineOptions: PosServiceLineOption[] = ((appointmentMenus ?? []) as AppointmentMenuSummary[])
    .filter((row) => Boolean(row.appointment_id))
    .map((row, index) => ({
      id: row.id ?? `appointment-menu-${row.appointment_id}-${index}`,
      appointmentId: row.appointment_id,
      label: row.menu_name ?? '施術メニュー',
      amount: Math.round(Number(row.price ?? 0)),
      taxRate: row.tax_rate ?? 0.1,
      taxIncluded: row.tax_included ?? true,
    }))
  const stayAppointmentMap = new Map(
    ((hotelStaysForPos ?? []) as HotelStayForPos[])
      .filter((row) => Boolean(row.appointment_id))
      .map((row) => [row.id, row.appointment_id as string])
  )
  const posHotelLineOptions: PosHotelLineOption[] = ((hotelChargesForPos ?? []) as HotelChargeForPos[])
    .map((row) => {
      const appointmentId = stayAppointmentMap.get(row.stay_id)
      if (!appointmentId) return null
      return {
        id: row.id,
        appointmentId,
        label: row.label || 'ホテル明細',
        amount: Math.round(Number(row.line_amount_jpy ?? 0)),
        taxRate: row.tax_rate ?? 0.1,
        taxIncluded: row.tax_included ?? true,
      }
    })
    .filter((row): row is PosHotelLineOption => Boolean(row))
  const modalCloseRedirect = '/payments'

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">会計管理</h1>
        <p className="text-sm text-gray-600">
          統合請求（トリミング + ホテル）を優先して会計確定できます。予約単位の会計はレガシー導線から利用してください。
        </p>
      </div>

      <InvoiceCheckoutPanel customerNameById={customerNameById} />
      <PosCheckoutPanel
        customers={customerOptions}
        products={productOptions}
        appointments={posAppointmentOptions}
        serviceLines={posServiceLineOptions}
        hotelLines={posHotelLineOptions}
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">会計一覧</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">全 {paymentList.length} 件</p>
            <Link
              href="/payments?modal=create&mode=legacy"
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
            <div className="space-y-2.5 md:hidden" data-testid="payments-list-mobile">
              {paymentList.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded border border-gray-200 p-3 text-sm text-gray-700"
                  data-testid={`payment-row-${payment.id}`}
                >
                  <p className="truncate font-semibold text-gray-900">
                    {getPaymentRelatedValue(payment.customers, 'full_name')}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    予約:{' '}
                    {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${paymentStateClass(payment.paid_at)}`}
                  >
                    {formatPaymentPaidState(payment.paid_at)}
                  </span>
                  <p className="mt-2 font-medium text-gray-900">金額: {payment.total_amount.toLocaleString()} 円</p>
                  <p className="text-xs text-gray-600">支払方法: {payment.method ?? '現金'}</p>
                  <p className="text-xs text-gray-600">支払日時: {formatPaymentPaidAt(payment.paid_at)}</p>
                  <p>備考: {payment.notes ?? 'なし'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/payments?edit=${payment.id}`}
                      className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      編集
                    </Link>
                    {payment.paid_at ? (
                      <Link
                        href={`/receipts/${payment.id}`}
                        className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        印刷
                      </Link>
                    ) : (
                      <span className="inline-flex h-7 items-center rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
                        未会計
                      </span>
                    )}
                    <form action={`/api/payments/${payment.id}`} method="post">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
                        削除
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <table className="min-w-full table-fixed text-left text-sm" data-testid="payments-list">
                <thead className="border-b bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2">対象</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">合計金額</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">会計状態</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">支払方法</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">支払日時</th>
                    <th className="px-2.5 py-2">備考</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentList.map((payment) => (
                    <tr
                      key={payment.id}
                      className="text-gray-700"
                      data-testid={`payment-row-${payment.id}`}
                    >
                      <td className="px-2.5 py-2 align-top">
                        <p className="truncate font-medium text-gray-900">
                          {getPaymentRelatedValue(payment.customers, 'full_name')}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                        </p>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap align-top">
                        {payment.total_amount.toLocaleString()} 円
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${paymentStateClass(payment.paid_at)}`}
                        >
                          {formatPaymentPaidState(payment.paid_at)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap align-top">{payment.method ?? '現金'}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap align-top">{formatPaymentPaidAt(payment.paid_at)}</td>
                      <td className="px-2.5 py-2 align-top">
                        <p className="line-clamp-2">{payment.notes ?? 'なし'}</p>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/payments?edit=${payment.id}`}
                            className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            編集
                          </Link>
                          {payment.paid_at ? (
                            <Link
                              href={`/receipts/${payment.id}`}
                              className="inline-flex h-7 items-center justify-center rounded border border-slate-300 bg-white px-2 py-0 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              印刷
                            </Link>
                          ) : (
                            <span className="inline-flex h-7 items-center rounded border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400">
                              未会計
                            </span>
                          )}
                          <form action={`/api/payments/${payment.id}`} method="post">
                            <input type="hidden" name="_method" value="delete" />
                            <Button type="submit" className="h-7 border border-red-300 bg-red-50 px-2 py-0 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap">
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
          closeRedirectTo={`${modalCloseRedirect}?mode=legacy`}
        />
      ) : null}
    </section>
  )
}
