'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { calculatePosCartTotals } from '@/lib/pos/checkout'

type CustomerOption = {
  id: string
  full_name: string
}

type ProductOption = {
  id: string
  name: string
  unit: string
}

type AppointmentOption = {
  id: string
  label: string
  customerId: string | null
}

type CartLine = {
  id: string
  productId: string
  label: string
  unit: string
  quantity: number
  unitAmount: number
  taxRate: number
  taxIncluded: boolean
}

type PosCheckoutPanelProps = {
  customers: CustomerOption[]
  products: ProductOption[]
  appointments: AppointmentOption[]
}

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString()} 円`
}

export function PosCheckoutPanel({ customers, products, appointments }: PosCheckoutPanelProps) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitAmount, setUnitAmount] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState('現金')
  const [cart, setCart] = useState<CartLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customerName = customers.find((c) => c.id === customerId)?.full_name ?? '未選択'
  const selectedAppointment = appointments.find((row) => row.id === appointmentId)

  const totals = useMemo(() => {
    return calculatePosCartTotals(
      cart.map((line) => ({
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        taxRate: line.taxRate,
        taxIncluded: line.taxIncluded,
      })),
      Number(discount || 0)
    )
  }, [cart, discount])

  function addProductLine() {
    const product = products.find((row) => row.id === selectedProductId)
    if (!product) return
    const qty = Math.max(1, Number(quantity) || 1)
    const price = Math.max(0, Number(unitAmount) || 0)
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random()}`
    setCart((prev) => [
      ...prev,
      {
        id,
        productId: product.id,
        label: product.name,
        unit: product.unit,
        quantity: qty,
        unitAmount: price,
        taxRate: 0.1,
        taxIncluded: true,
      },
    ])
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((line) => line.id !== lineId))
  }

  async function submitCheckout() {
    if (!customerId || !appointmentId || cart.length === 0) {
      setError('予約・顧客・明細を指定してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const createResponse = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          appointment_id: appointmentId,
          lines: cart.map((line) => ({
            line_type: 'product',
            source_id: line.productId,
            label: line.label,
            quantity: line.quantity,
            unit_amount: line.unitAmount,
            tax_rate: line.taxRate,
            tax_included: line.taxIncluded,
          })),
          discount_amount: totals.discount,
        }),
      })
      const createBody = (await createResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { order?: { id?: string } }; message?: string }
        | null
      const orderId = createBody?.data?.order?.id
      if (!createResponse.ok || !orderId) {
        throw new Error(createBody?.message ?? 'POS伝票の作成に失敗しました。')
      }

      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pos-confirm-${Date.now()}-${Math.random()}`
      const confirmResponse = await fetch(`/api/pos/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          idempotency_key: idempotencyKey,
          notes: null,
        }),
      })
      const confirmBody = (await confirmResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { receipt_path?: string; payment_id?: string }; message?: string }
        | null
      if (!confirmResponse.ok || !confirmBody?.ok) {
        throw new Error(confirmBody?.message ?? 'POS会計確定に失敗しました。')
      }

      if (confirmBody.data?.receipt_path) {
        router.push(confirmBody.data.receipt_path)
        router.refresh()
        return
      }
      if (confirmBody.data?.payment_id) {
        router.push(`/receipts/${confirmBody.data.payment_id}`)
        router.refresh()
        return
      }
      throw new Error('領収書への遷移情報が返却されませんでした。')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'POS会計確定に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-4" data-testid="pos-checkout-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">POS会計（β）</p>
          <p className="text-xs text-amber-800">店販を含む会計を予約に紐づけて確定できます。</p>
        </div>
      </div>

      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-700">
          予約
          <select
            value={appointmentId}
            onChange={(event) => {
              const nextAppointmentId = event.target.value
              setAppointmentId(nextAppointmentId)
              const matched = appointments.find((row) => row.id === nextAppointmentId)
              if (matched?.customerId) {
                setCustomerId(matched.customerId)
              }
            }}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">予約を選択</option>
            {appointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-700">
          顧客
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">顧客を選択</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-700">
          支払方法
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {['現金', 'カード', '電子マネー', 'QR決済', 'その他'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedAppointment ? (
        <p className="mt-2 text-xs text-slate-600">対象予約: {selectedAppointment.label}</p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <label className="text-xs text-slate-700">
          商品
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">商品を選択</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-700">
          数量
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-700">
          単価(税込)
          <input
            type="number"
            min="0"
            step="1"
            value={unitAmount}
            onChange={(event) => setUnitAmount(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <Button type="button" onClick={addProductLine} disabled={!selectedProductId}>
          明細追加
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-slate-500">
            <tr>
              <th className="px-2 py-2">商品</th>
              <th className="px-2 py-2">数量</th>
              <th className="px-2 py-2">単価</th>
              <th className="px-2 py-2">小計</th>
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cart.map((line) => (
              <tr key={line.id} className="text-slate-700">
                <td className="px-2 py-2">
                  {line.label} ({line.unit})
                </td>
                <td className="px-2 py-2">{line.quantity}</td>
                <td className="px-2 py-2">{formatYen(line.unitAmount)}</td>
                <td className="px-2 py-2">{formatYen(line.quantity * line.unitAmount)}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {cart.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-slate-500">
                  明細がありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="text-xs text-slate-700">
          値引き
          <input
            type="number"
            min="0"
            step="1"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm md:w-40"
          />
        </label>
        <div className="text-right text-sm text-slate-700">
          <p>顧客: {customerName}</p>
          <p>小計: {formatYen(totals.subtotal)}</p>
          <p>税額: {formatYen(totals.tax)}</p>
          <p>値引き: {formatYen(totals.discount)}</p>
          <p className="text-lg font-semibold text-slate-900">合計: {formatYen(totals.total)}</p>
          <Button
            type="button"
            className="mt-2"
            disabled={submitting || !appointmentId || !customerId || cart.length === 0}
            onClick={() => void submitCheckout()}
          >
            {submitting ? '確定中...' : '会計確定して領収書へ'}
          </Button>
        </div>
      </div>
    </div>
  )
}
