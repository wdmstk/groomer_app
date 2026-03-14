import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { PaymentCreateModal } from '@/components/payments/PaymentCreateModal'

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
  }>
}

const paymentMethodOptions = ['現金', 'カード', '電子マネー', 'QR決済', 'その他']

function getRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return '未登録'
  if (Array.isArray(relation)) return relation[0]?.[key] ?? '未登録'
  return relation[key] ?? '未登録'
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '日時未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '日時未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const resolvedSearchParams = await searchParams
  const activeTab = 'list'
  const isCreateModalOpen =
    resolvedSearchParams?.modal === 'create' || resolvedSearchParams?.tab === 'new'
  const editId = resolvedSearchParams?.edit
  const prefillAppointmentId = resolvedSearchParams?.appointment_id ?? ''
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, customers(full_name), appointments(id)'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, customer_id, start_time, customers(full_name), pets(name)')
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })

  const { data: appointmentMenus } = await supabase
    .from('appointment_menus')
    .select('appointment_id, price, tax_rate, tax_included')
    .eq('store_id', storeId)

  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  const { data: editPayment } = editId
    ? await supabase
        .from('payments')
        .select(
          'id, appointment_id, customer_id, visit_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes'
        )
        .eq('id', editId)
        .eq('store_id', storeId)
        .single()
    : { data: null }

  const paymentList = payments ?? []
  const appointmentOptions: AppointmentOption[] = appointments ?? []
  const customerOptions: CustomerOption[] = customers ?? []
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
    const date = formatDateTimeJst(appointment.start_time)
    const customerName = getRelatedValue(appointment.customers, 'full_name')
    const petName = getRelatedValue(appointment.pets, 'name')
    const totals = appointmentTotals.get(appointment.id) ?? { subtotal: 0, tax: 0, total: 0 }
    return {
      id: appointment.id,
      label: `${date} / ${customerName} / ${petName}`,
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
      </div>

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
                href="/payments?tab=list&modal=create"
                className="inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                新規登録
              </Link>
            </div>
          </div>
          {paymentList.length === 0 ? (
            <p className="text-sm text-gray-500">会計がまだ登録されていません。</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {paymentList.map((payment) => (
                  <article key={payment.id} className="rounded border p-3 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {getRelatedValue(payment.customers, 'full_name')}
                    </p>
                    <p>
                      予約:{' '}
                      {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                    </p>
                    <p>金額: {payment.total_amount.toLocaleString()} 円</p>
                    <p>会計状態: {payment.paid_at ? '会計済' : '未会計'}</p>
                    <p>支払方法: {payment.method ?? '現金'}</p>
                    <p>支払日時: {payment.paid_at ?? '未払い'}</p>
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
                <table className="min-w-full text-sm text-left">
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
                      <tr key={payment.id} className="text-gray-700">
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {getRelatedValue(payment.customers, 'full_name')}
                        </td>
                        <td className="py-3 px-2">
                          {appointmentLabelById.get(payment.appointment_id) ?? payment.appointment_id}
                        </td>
                        <td className="py-3 px-2">{payment.total_amount.toLocaleString()} 円</td>
                        <td className="py-3 px-2">{payment.paid_at ? '会計済' : '未会計'}</td>
                        <td className="py-3 px-2">{payment.method ?? '現金'}</td>
                        <td className="py-3 px-2">{payment.paid_at ?? '未払い'}</td>
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
          closeRedirectTo={modalCloseRedirect}
        />
      ) : null}
    </section>
  )
}
