'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'

type CustomerOption = {
  id: string
  full_name: string
}

type AppointmentOption = {
  id: string
}

type StaffOption = {
  id: string
  full_name: string
}

type EditVisit = {
  id: string
  customer_id: string | null
  appointment_id: string | null
  staff_id: string | null
  visit_date: string | null
  menu: string | null
  total_amount: number | null
  notes: string | null
}

type VisitCreateModalProps = {
  editVisit: EditVisit | null
  customerOptions: CustomerOption[]
  appointmentOptions: AppointmentOption[]
  staffOptions: StaffOption[]
  modalCloseRedirect: string
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

export function VisitCreateModal({
  editVisit,
  customerOptions,
  appointmentOptions,
  staffOptions,
  modalCloseRedirect,
}: VisitCreateModalProps) {
  return (
    <FormModal
      title={editVisit ? '来店履歴の更新' : '新規来店登録'}
      closeRedirectTo={modalCloseRedirect}
      description="来店履歴はモーダルで入力します。"
      reopenLabel="来店モーダルを開く"
    >
      <form
        action={editVisit ? `/api/visits/${editVisit.id}` : '/api/visits'}
        method="post"
        className="space-y-4"
      >
        {editVisit ? <input type="hidden" name="_method" value="put" /> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-gray-700">
            顧客
            <select
              name="customer_id"
              required
              defaultValue={editVisit?.customer_id ?? ''}
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="" disabled>
                選択してください
              </option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            予約ID (任意)
            <select
              name="appointment_id"
              defaultValue={editVisit?.appointment_id ?? ''}
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">予約なし</option>
              {appointmentOptions.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            担当スタッフ
            <select
              name="staff_id"
              required
              defaultValue={editVisit?.staff_id ?? ''}
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="" disabled>
                選択してください
              </option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            来店日時
            <Input
              type="datetime-local"
              name="visit_date"
              required
              defaultValue={toDateTimeLocalValue(editVisit?.visit_date)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            施術メニュー
            <Input
              name="menu"
              required
              defaultValue={editVisit?.menu ?? ''}
              placeholder="シャンプー + カット"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            合計金額
            <Input
              type="number"
              name="total_amount"
              required
              defaultValue={editVisit?.total_amount?.toString() ?? ''}
              placeholder="8500"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
            備考
            <Input
              name="notes"
              defaultValue={editVisit?.notes ?? ''}
              placeholder="連絡事項など"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit">{editVisit ? '更新する' : '登録する'}</Button>
          {editVisit ? (
            <Link href={modalCloseRedirect} className="text-sm text-gray-500">
              編集をやめる
            </Link>
          ) : null}
        </div>
      </form>
    </FormModal>
  )
}
