import { createStoreScopedClient } from '@/lib/supabase/store'
import { PrintButton } from '@/components/receipts/PrintButton'

type ReceiptPageProps = {
  params: Promise<{ payment_id: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getRelatedValue<T extends Record<string, string>>(
  relation: T | T[] | null | undefined,
  key: keyof T
) {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.[key] ?? null
  return relation[key] ?? null
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '未払い'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未払い'
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

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { payment_id } = await params
  const { supabase, storeId } = await createStoreScopedClient()

  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, appointment_id, customer_id, status, method, subtotal_amount, tax_amount, discount_amount, total_amount, paid_at, notes, customers(full_name)'
    )
    .eq('id', payment_id)
    .eq('store_id', storeId)
    .single()

  const relatedCustomerName = getRelatedValue(
    payment?.customers as { full_name: string } | { full_name: string }[] | null | undefined,
    'full_name'
  )

  const { data: fallbackCustomer } =
    !relatedCustomerName && payment?.customer_id
      ? await supabase
          .from('customers')
          .select('full_name')
          .eq('id', payment.customer_id)
          .eq('store_id', storeId)
          .single()
      : { data: null }

  const customerName = relatedCustomerName || fallbackCustomer?.full_name || 'お客様'

  const { data: appointmentMenus } = payment?.appointment_id
    ? await supabase
        .from('appointment_menus')
        .select('menu_name, price, duration')
        .eq('appointment_id', payment.appointment_id)
        .eq('store_id', storeId)
    : { data: [] }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6 rounded bg-white p-8 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">領収書</h1>
            <p className="text-sm text-gray-500">No. {payment?.id ?? '-'}</p>
          </div>
          <PrintButton />
        </div>

        <div className="grid gap-2 text-sm text-gray-700">
          <p>
            <span className="font-semibold text-gray-900">宛名:</span>{' '}
            {customerName} 様
          </p>
          <p>
            <span className="font-semibold text-gray-900">支払方法:</span> {payment?.method ?? '未設定'}
          </p>
          <p>
            <span className="font-semibold text-gray-900">支払ステータス:</span>{' '}
            {payment?.status ?? '未払い'}
          </p>
          <p>
            <span className="font-semibold text-gray-900">支払日時:</span>{' '}
            {formatDateTimeJst(payment?.paid_at)}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">施術内訳</h2>
          <div className="mt-2 overflow-hidden rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">メニュー</th>
                  <th className="px-3 py-2 text-right">金額</th>
                  <th className="px-3 py-2 text-right">時間</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(appointmentMenus ?? []).map((menu) => (
                  <tr key={`${menu.menu_name}-${menu.price}`} className="text-gray-700">
                    <td className="px-3 py-2">{menu.menu_name}</td>
                    <td className="px-3 py-2 text-right">{menu.price.toLocaleString()} 円</td>
                    <td className="px-3 py-2 text-right">{menu.duration} 分</td>
                  </tr>
                ))}
                {(appointmentMenus ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                      施術内訳がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-1 text-right text-sm text-gray-700">
          <p>
            小計: {payment?.subtotal_amount?.toLocaleString() ?? 0} 円
          </p>
          <p>
            税額: {payment?.tax_amount?.toLocaleString() ?? 0} 円
          </p>
          <p>
            割引: {payment?.discount_amount?.toLocaleString() ?? 0} 円
          </p>
          <p className="text-lg font-semibold text-gray-900">
            合計: {payment?.total_amount?.toLocaleString() ?? 0} 円
          </p>
        </div>

        {payment?.notes && (
          <p className="text-sm text-gray-500">備考: {payment.notes}</p>
        )}

        <p className="text-sm text-gray-600">この度はご利用いただき、誠にありがとうございます。</p>
      </div>
    </div>
  )
}
