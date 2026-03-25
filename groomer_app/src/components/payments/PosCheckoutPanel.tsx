'use client'

import { useEffect, useMemo, useState } from 'react'
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

type ServiceLineOption = {
  id: string
  appointmentId: string
  label: string
  amount: number
  taxRate: number
  taxIncluded: boolean
}

type HotelLineOption = {
  id: string
  appointmentId: string
  label: string
  amount: number
  taxRate: number
  taxIncluded: boolean
}

type CartLine = {
  id: string
  lineType: 'product' | 'service'
  sourceId: string | null
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
  serviceLines: ServiceLineOption[]
  hotelLines: HotelLineOption[]
}

type PosSessionSummary = {
  sales_total: number
  cash_expected: number
  cash_counted: number
  cash_diff: number
}

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString()} 円`
}

export function PosCheckoutPanel({ customers, products, appointments, serviceLines, hotelLines }: PosCheckoutPanelProps) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionOpenedAt, setSessionOpenedAt] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionSubmitting, setSessionSubmitting] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const [eventType, setEventType] = useState<'cash_in' | 'cash_out' | 'adjustment'>('cash_in')
  const [eventAmount, setEventAmount] = useState('0')
  const [eventReason, setEventReason] = useState('')
  const [closeCountedAmount, setCloseCountedAmount] = useState('0')
  const [closeNote, setCloseNote] = useState('')
  const [sessionSummary, setSessionSummary] = useState<PosSessionSummary | null>(null)
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
  const selectableServiceLines = serviceLines.filter((line) => line.appointmentId === appointmentId)
  const selectableHotelLines = hotelLines.filter((line) => line.appointmentId === appointmentId)

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

  async function loadOpenSession() {
    setSessionLoading(true)
    try {
      const response = await fetch('/api/pos/sessions/open', { method: 'GET' })
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { session?: { id?: string; opened_at?: string } | null }; message?: string }
        | null
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? 'レジセッションの取得に失敗しました。')
      }
      setSessionId(body.data?.session?.id ?? null)
      setSessionOpenedAt(body.data?.session?.opened_at ?? null)
    } catch (sessionError) {
      setSessionMessage(sessionError instanceof Error ? sessionError.message : 'レジセッションの取得に失敗しました。')
    } finally {
      setSessionLoading(false)
    }
  }

  useEffect(() => {
    void loadOpenSession()
  }, [])

  async function openSession() {
    setSessionSubmitting(true)
    setSessionMessage(null)
    try {
      const response = await fetch('/api/pos/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'POS会計画面から開局' }),
      })
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { session?: { id?: string; opened_at?: string } }; message?: string }
        | null
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? '開局に失敗しました。')
      }
      setSessionId(body.data?.session?.id ?? null)
      setSessionOpenedAt(body.data?.session?.opened_at ?? null)
      setSessionSummary(null)
      setSessionMessage('レジを開局しました。')
    } catch (sessionError) {
      setSessionMessage(sessionError instanceof Error ? sessionError.message : '開局に失敗しました。')
    } finally {
      setSessionSubmitting(false)
    }
  }

  async function submitCashDrawerEvent() {
    if (!sessionId) {
      setSessionMessage('先にレジを開局してください。')
      return
    }
    const amount = Math.max(0, Number(eventAmount) || 0)
    setSessionSubmitting(true)
    setSessionMessage(null)
    try {
      const response = await fetch('/api/pos/cash-drawer-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          amount,
          reason: eventReason || null,
        }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? '現金入出金の登録に失敗しました。')
      }
      setEventAmount('0')
      setEventReason('')
      setSessionMessage('現金入出金を登録しました。')
    } catch (sessionError) {
      setSessionMessage(sessionError instanceof Error ? sessionError.message : '現金入出金の登録に失敗しました。')
    } finally {
      setSessionSubmitting(false)
    }
  }

  async function closeSession() {
    if (!sessionId) {
      setSessionMessage('開いているレジセッションがありません。')
      return
    }
    const countedAmount = Math.max(0, Number(closeCountedAmount) || 0)
    setSessionSubmitting(true)
    setSessionMessage(null)
    try {
      const response = await fetch(`/api/pos/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cash_counted_amount: countedAmount,
          note: closeNote || null,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { summary?: PosSessionSummary }; message?: string }
        | null
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? 'レジ締めに失敗しました。')
      }
      setSessionSummary(body.data?.summary ?? null)
      setSessionId(null)
      setSessionOpenedAt(null)
      setCloseNote('')
      setSessionMessage('レジ締めを完了しました。')
    } catch (sessionError) {
      setSessionMessage(sessionError instanceof Error ? sessionError.message : 'レジ締めに失敗しました。')
    } finally {
      setSessionSubmitting(false)
    }
  }

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
        lineType: 'product',
        sourceId: product.id,
        label: product.name,
        unit: product.unit,
        quantity: qty,
        unitAmount: price,
        taxRate: 0.1,
        taxIncluded: true,
      },
    ])
  }

  function addServiceLines() {
    if (!appointmentId) return
    const idPrefix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `svc-${Date.now()}-${Math.random()}`
    setCart((prev) => [
      ...prev,
      ...selectableServiceLines.map((line, index) => ({
        id: `${idPrefix}-service-${index}`,
        lineType: 'service' as const,
        sourceId: line.id,
        label: `施術: ${line.label}`,
        unit: '式',
        quantity: 1,
        unitAmount: Math.max(0, Number(line.amount) || 0),
        taxRate: line.taxRate,
        taxIncluded: line.taxIncluded,
      })),
    ])
  }

  function addHotelLines() {
    if (!appointmentId) return
    const idPrefix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `hotel-${Date.now()}-${Math.random()}`
    setCart((prev) => [
      ...prev,
      ...selectableHotelLines.map((line, index) => ({
        id: `${idPrefix}-hotel-${index}`,
        lineType: 'service' as const,
        sourceId: line.id,
        label: `ホテル: ${line.label}`,
        unit: '式',
        quantity: 1,
        unitAmount: Math.max(0, Number(line.amount) || 0),
        taxRate: line.taxRate,
        taxIncluded: line.taxIncluded,
      })),
    ])
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((line) => line.id !== lineId))
  }

  async function submitCheckout() {
    if (!sessionId) {
      setError('先にレジを開局してください。')
      return
    }
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
          session_id: sessionId,
          lines: cart.map((line) => ({
            line_type: line.lineType,
            source_id: line.sourceId,
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

      <div className="mb-3 rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">レジセッション</p>
            <p className="text-xs text-slate-600">
              {sessionLoading
                ? '確認中...'
                : sessionId
                  ? `開局中: ${sessionOpenedAt ? new Date(sessionOpenedAt).toLocaleString('ja-JP') : sessionId}`
                  : '未開局'}
            </p>
          </div>
          <Button type="button" onClick={() => void openSession()} disabled={sessionSubmitting || Boolean(sessionId)}>
            開局
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_120px_auto] md:items-end">
          <label className="text-xs text-slate-700">
            入出金種別
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as 'cash_in' | 'cash_out' | 'adjustment')}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="cash_in">入金</option>
              <option value="cash_out">出金</option>
              <option value="adjustment">調整</option>
            </select>
          </label>
          <label className="text-xs text-slate-700">
            金額
            <input
              type="number"
              min="0"
              step="1"
              value={eventAmount}
              onChange={(event) => setEventAmount(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-700">
            理由
            <input
              value={eventReason}
              onChange={(event) => setEventReason(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Button type="button" onClick={() => void submitCashDrawerEvent()} disabled={sessionSubmitting || !sessionId}>
            登録
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-xs text-slate-700">
            実残高
            <input
              type="number"
              min="0"
              step="1"
              value={closeCountedAmount}
              onChange={(event) => setCloseCountedAmount(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-700">
            締めメモ
            <input
              value={closeNote}
              onChange={(event) => setCloseNote(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Button type="button" onClick={() => void closeSession()} disabled={sessionSubmitting || !sessionId}>
            レジ締め
          </Button>
        </div>

        {sessionSummary ? (
          <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
            <p>売上合計: {formatYen(sessionSummary.sales_total)}</p>
            <p>現金期待額: {formatYen(sessionSummary.cash_expected)}</p>
            <p>実残高: {formatYen(sessionSummary.cash_counted)}</p>
            <p>差異: {formatYen(sessionSummary.cash_diff)}</p>
          </div>
        ) : null}

        {sessionMessage ? <p className="mt-2 text-xs text-slate-700">{sessionMessage}</p> : null}
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

      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" onClick={addServiceLines} disabled={!appointmentId || selectableServiceLines.length === 0}>
          施術明細を取込（{selectableServiceLines.length}件）
        </Button>
        <Button type="button" onClick={addHotelLines} disabled={!appointmentId || selectableHotelLines.length === 0}>
          ホテル明細を取込（{selectableHotelLines.length}件）
        </Button>
      </div>

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
              <th className="px-2 py-2">区分</th>
              <th className="px-2 py-2">明細</th>
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
                  {line.lineType === 'product' ? '店販' : 'サービス'}
                </td>
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
                <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
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
            disabled={submitting || !sessionId || !appointmentId || !customerId || cart.length === 0}
            onClick={() => void submitCheckout()}
          >
            {submitting ? '確定中...' : '会計確定して領収書へ'}
          </Button>
        </div>
      </div>
    </div>
  )
}
