'use client'

import { useMemo, useState } from 'react'

type AppointmentOption = {
  id: string
  label: string
  customerId: string | null
  subtotal: number
  tax: number
  total: number
}

type PaymentFormProps = {
  action: string
  isEdit: boolean
  initialAppointmentId: string
  initialMethod: string
  initialDiscountAmount: number
  initialNotes: string
  paymentMethodOptions: string[]
  appointmentOptions: AppointmentOption[]
  customerNameById: Record<string, string>
}

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString()} 円`
}

export function PaymentForm({
  action,
  isEdit,
  initialAppointmentId,
  initialMethod,
  initialDiscountAmount,
  initialNotes,
  paymentMethodOptions,
  appointmentOptions,
  customerNameById,
}: PaymentFormProps) {
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId)
  const [method, setMethod] = useState(initialMethod)
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount)
  const [notes, setNotes] = useState(initialNotes)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `payment-${Date.now()}-${Math.random()}`
  )

  const selectedAppointment = useMemo(
    () => appointmentOptions.find((option) => option.id === appointmentId),
    [appointmentId, appointmentOptions]
  )

  const customerId = selectedAppointment?.customerId ?? ''
  const customerName = customerId ? customerNameById[customerId] ?? '未登録' : '未選択'
  const subtotal = selectedAppointment?.subtotal ?? 0
  const tax = selectedAppointment?.tax ?? 0
  const total = Math.max(0, (selectedAppointment?.total ?? 0) - discountAmount)

  return (
    <form action={action} method="post" className="space-y-4" onSubmit={() => setIsSubmitting(true)}>
      {isEdit && <input type="hidden" name="_method" value="put" />}
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="status" value="支払済" />
      {!isEdit ? <input type="hidden" name="idempotency_key" value={idempotencyKey} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-gray-700">
          予約
          <select
            name="appointment_id"
            required
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="" disabled>
              選択してください
            </option>
            {appointmentOptions.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">形式: 日時 / 顧客 / ペット (JST)</p>
        </label>

        <label className="space-y-2 text-sm text-gray-700">
          顧客 (予約から自動設定)
          <input
            type="text"
            value={customerName}
            readOnly
            className="w-full rounded border bg-gray-50 p-2 text-gray-600"
          />
        </label>

        <label className="space-y-2 text-sm text-gray-700">
          支払方法
          <select
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            {paymentMethodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-gray-700">
          割引額 (任意)
          <input
            type="number"
            name="discount_amount"
            min={0}
            value={discountAmount}
            onChange={(event) => setDiscountAmount(Number(event.target.value || 0))}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>

        <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
          備考
          <input
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
        <p className="mb-1 font-semibold text-gray-900">会計確認</p>
        <p>小計: {formatYen(subtotal)}</p>
        <p>税額: {formatYen(tax)}</p>
        <p>割引: {formatYen(discountAmount)}</p>
        <p className="font-semibold text-gray-900">合計見込み: {formatYen(total)}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {isSubmitting ? '送信中...' : isEdit ? '会計確定して更新' : '会計確定して登録'}
        </button>
      </div>
      <p className="text-xs text-gray-500">会計確定後、領収書画面へ遷移します。</p>
    </form>
  )
}
