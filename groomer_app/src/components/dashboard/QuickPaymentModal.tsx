'use client'

import { useCallback, useState } from 'react'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'

type QuickPaymentModalProps = {
  appointmentId: string
  customerId: string
  disabled?: boolean
}

const paymentMethodOptions = ['現金', 'カード', '電子マネー', 'QR決済', 'その他']

export function QuickPaymentModal({ appointmentId, customerId, disabled = false }: QuickPaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState('現金')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `quick-payment-${Date.now()}-${Math.random()}`
  )
  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])
  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open,
    onClose: handleClose,
  })

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        会計する
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="w-full max-w-md rounded bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">会計入力</h3>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                閉じる
              </button>
            </div>

            <form
              action="/api/payments"
              method="post"
              className="space-y-3"
              onSubmit={() => setIsSubmitting(true)}
            >
              <input type="hidden" name="appointment_id" value={appointmentId} />
              <input type="hidden" name="customer_id" value={customerId} />
              <input type="hidden" name="idempotency_key" value={idempotencyKey} />

              <label className="block space-y-1 text-xs text-gray-700">
                <span>支払い方法</span>
                <select
                  name="method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="w-full rounded border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs text-gray-700">
                <span>割引額</span>
                <input
                  type="number"
                  min={0}
                  name="discount_amount"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(Number(event.target.value || 0))}
                  className="w-full rounded border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>

              <label className="block space-y-1 text-xs text-gray-700">
                <span>備考</span>
                <input
                  type="text"
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="任意"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {isSubmitting ? '送信中...' : '会計確定'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="rounded border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
