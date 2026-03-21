'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'
import { Button } from '@/components/ui/Button'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'

type CustomerOption = {
  id: string
  full_name: string
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

type ServiceMenuOption = {
  id: string
  name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_active: boolean | null
}

type AppointmentTemplate = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  menu_ids: string[]
  duration: number | null
  status: string | null
}

type EditAppointment = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string | null
  end_time: string | null
  menu: string | null
  duration: number | null
  status: string | null
  notes: string | null
  reservation_payment_method?: string | null
}

type ReservationPaymentSettings = {
  prepayment_enabled: boolean
  card_hold_enabled: boolean
  cancellation_day_before_percent: number
  cancellation_same_day_percent: number
  cancellation_no_show_percent: number
  no_show_charge_mode: 'manual' | 'auto'
}

type AppointmentCreateModalProps = {
  editAppointment: EditAppointment | null
  customerOptions: CustomerOption[]
  petOptions: PetOption[]
  staffOptions: StaffOption[]
  menuOptions: ServiceMenuOption[]
  defaultMenuIds: string[]
  statusOptions: string[]
  formAction: string
  defaultStartTime: string
  defaultEndTime: string
  templates: AppointmentTemplate[]
  closeRedirectTo?: string
  initialPrefill?: {
    customer_id?: string
    pet_id?: string
    staff_id?: string
    status?: string
    notes?: string
  }
  reservationPaymentSettings?: ReservationPaymentSettings
  recommendationMessage?: string
  customerNoShowCounts?: Record<string, number>
  followupTaskId?: string
  reofferId?: string
}

export function AppointmentCreateModal(props: AppointmentCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const handleClose = useCallback(() => {
    if (props.closeRedirectTo) {
      router.push(props.closeRedirectTo)
      return
    }
    setOpen(false)
  }, [props.closeRedirectTo, router])
  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open,
    onClose: handleClose,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded border bg-white p-3">
        <p className="text-sm text-gray-600">予約登録は1画面モーダルで入力します。</p>
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)}>
            予約モーダルを開く
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
                {props.editAppointment ? '予約情報の更新' : '新規予約登録'}
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
            <AppointmentForm
              {...props}
              singleColumn
              cancelHref={props.closeRedirectTo ?? '/appointments?tab=list'}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
