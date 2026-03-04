'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PaymentForm } from '@/components/payments/PaymentForm'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'

type AppointmentOption = {
  id: string
  label: string
  customerId: string | null
  subtotal: number
  tax: number
  total: number
}

type PaymentCreateModalProps = {
  action: string
  isEdit: boolean
  initialAppointmentId: string
  initialMethod: string
  initialDiscountAmount: number
  initialNotes: string
  paymentMethodOptions: string[]
  appointmentOptions: AppointmentOption[]
  customerNameById: Record<string, string>
  closeRedirectTo: string
}

export function PaymentCreateModal({
  action,
  isEdit,
  initialAppointmentId,
  initialMethod,
  initialDiscountAmount,
  initialNotes,
  paymentMethodOptions,
  appointmentOptions,
  customerNameById,
  closeRedirectTo,
}: PaymentCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const handleClose = useCallback(() => {
    if (closeRedirectTo) {
      router.push(closeRedirectTo)
      return
    }
    setOpen(false)
  }, [closeRedirectTo, router])
  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open,
    onClose: handleClose,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded border bg-white p-3">
        <p className="text-sm text-gray-600">会計入力はモーダルで行います。</p>
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)}>
            会計モーダルを開く
          </Button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEdit ? '会計情報の更新' : '新規会計登録'}
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>

            <PaymentForm
              action={action}
              isEdit={isEdit}
              initialAppointmentId={initialAppointmentId}
              initialMethod={initialMethod}
              initialDiscountAmount={initialDiscountAmount}
              initialNotes={initialNotes}
              paymentMethodOptions={paymentMethodOptions}
              appointmentOptions={appointmentOptions}
              customerNameById={customerNameById}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
