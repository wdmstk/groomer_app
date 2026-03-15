'use client'

import Link from 'next/link'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AppointmentMenuSelector } from '@/components/appointments/AppointmentMenuSelector'
import { DEFAULT_RESERVATION_PAYMENT_SETTINGS } from '@/lib/appointments/reservation-payment'
import { APPOINTMENT_METRIC_EVENTS } from '@/lib/appointments/metrics'

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

type AppointmentFormProps = {
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
  singleColumn?: boolean
  initialPrefill?: {
    customer_id?: string
    pet_id?: string
    staff_id?: string
    status?: string
    notes?: string
  }
  recommendationMessage?: string
  customerNoShowCounts?: Record<string, number>
  cancelHref?: string
  followupTaskId?: string
  reofferId?: string
  reservationPaymentSettings: ReservationPaymentSettings
}

function toLocalInputValue(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function formatDateTimeJst(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

type QrPayload = {
  customer_id?: string
  pet_id?: string
}

type CreatedAppointmentSummary = {
  id: string
  groupId: string | null
  customerId: string
  petId: string
  customerName: string
  petName: string
  startTime: string
  menuSummary: string
}

export function AppointmentForm({
  editAppointment,
  customerOptions,
  petOptions,
  staffOptions,
  menuOptions,
  defaultMenuIds,
  statusOptions,
  formAction,
  defaultStartTime,
  defaultEndTime,
  templates,
  singleColumn = false,
  initialPrefill,
  recommendationMessage,
  customerNoShowCounts = {},
  cancelHref = '/appointments?tab=list',
  followupTaskId,
  reofferId,
  reservationPaymentSettings = DEFAULT_RESERVATION_PAYMENT_SETTINGS,
}: AppointmentFormProps) {
  const [customerList, setCustomerList] = useState(customerOptions)
  const [petList, setPetList] = useState(petOptions)
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    editAppointment?.customer_id ?? initialPrefill?.customer_id ?? ''
  )
  const [selectedPetId, setSelectedPetId] = useState(
    editAppointment?.pet_id ?? initialPrefill?.pet_id ?? ''
  )
  const [selectedStaffId, setSelectedStaffId] = useState(
    editAppointment?.staff_id ?? initialPrefill?.staff_id ?? ''
  )
  const [startTime, setStartTime] = useState(defaultStartTime)
  const [endTime, setEndTime] = useState(defaultEndTime)
  const [selectedMenuIds, setSelectedMenuIds] = useState(defaultMenuIds)
  const [status, setStatus] = useState(editAppointment?.status ?? initialPrefill?.status ?? '予約済')
  const [notes, setNotes] = useState(editAppointment?.notes ?? initialPrefill?.notes ?? '')
  const [reservationPaymentMethod, setReservationPaymentMethod] = useState(
    editAppointment?.reservation_payment_method ?? 'none'
  )
  const [copyMessage, setCopyMessage] = useState('')
  const [copyTimeMode, setCopyTimeMode] = useState<'keep_start' | 'copy_full'>('keep_start')
  const [quickCustomerName, setQuickCustomerName] = useState('')
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('')
  const [quickPetName, setQuickPetName] = useState('')
  const [quickPetBreed, setQuickPetBreed] = useState('')
  const [quickCreateLoading, setQuickCreateLoading] = useState(false)
  const [quickCreateMessage, setQuickCreateMessage] = useState('')
  const [quickCreateError, setQuickCreateError] = useState('')
  const [fieldChangeCount, setFieldChangeCount] = useState(0)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [createdAppointments, setCreatedAppointments] = useState<CreatedAppointmentSummary[]>([])
  const [currentGroupId, setCurrentGroupId] = useState('')
  const [qrMessage, setQrMessage] = useState('')
  const [qrError, setQrError] = useState('')
  const [qrDecoding, setQrDecoding] = useState(false)
  const formOpenedAtRef = useRef(Date.now())
  const createdAppointmentsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (createdAppointments.length === 0) return
    createdAppointmentsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [createdAppointments.length])

  const onInputChanged = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setFieldChangeCount((prev) => prev + 1)
    setter(event.target.value)
  }

  const onSelectChanged = (setter: (value: string) => void) => (event: ChangeEvent<HTMLSelectElement>) => {
    setFieldChangeCount((prev) => prev + 1)
    setter(event.target.value)
  }

  const sendFormMetric = () => {
    const payload = {
      event_type: APPOINTMENT_METRIC_EVENTS.appointmentFormSubmit,
      mode: editAppointment ? 'edit' : 'new',
      elapsed_ms: Math.max(0, Date.now() - formOpenedAtRef.current),
      click_count: fieldChangeCount,
      field_change_count: fieldChangeCount,
      selected_menu_count: selectedMenuIds.length,
      used_template_copy: copyMessage.includes('反映'),
    }
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/metrics/appointments', blob)
      return
    }
    void fetch('/api/metrics/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError('')
    setSubmitMessage('')
    setSubmitting(true)
    sendFormMetric()

    try {
      const formData = new FormData(event.currentTarget)
      const response = await fetch(formAction, {
        method: 'POST',
        body: formData,
        headers: {
          accept: 'application/json',
        },
      })

      if (response.redirected) {
        window.location.href = response.url
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string
            id?: string
            groupId?: string
            appointment?: {
              id?: string
              group_id?: string | null
              customer_id?: string | null
              pet_id?: string | null
              start_time?: string | null
              menu?: string | null
            } | null
            conflict?: {
              startTime?: string | null
              endTime?: string | null
            } | null
          }
        | null

      if (response.status === 409) {
        const conflict = payload?.conflict
        if (conflict?.startTime || conflict?.endTime) {
          setSubmitError(
            `${payload?.message ?? '同じスタッフに時間が重複する予約があります。'} ` +
              `衝突: ${formatDateTimeJst(conflict.startTime)} - ${formatDateTimeJst(conflict.endTime)}`
          )
        } else {
          setSubmitError(payload?.message ?? '同じスタッフに時間が重複する予約があります。')
        }
        return
      }

      if (!response.ok) {
        setSubmitError(payload?.message ?? '予約の保存に失敗しました。')
        return
      }

      if (editAppointment) {
        window.location.href = '/appointments'
        return
      }

      const createdAppointment = payload?.appointment
      const resolvedGroupId =
        createdAppointment?.group_id ?? payload?.groupId ?? currentGroupId ?? ''
      const createdCustomerId = createdAppointment?.customer_id ?? selectedCustomerId
      const createdPetId = createdAppointment?.pet_id ?? selectedPetId
      const customerName =
        customerList.find((customer) => customer.id === createdCustomerId)?.full_name ?? '顧客'
      const petName = petList.find((pet) => pet.id === createdPetId)?.name ?? 'ペット'
      setCreatedAppointments((prev) => [
        {
          id: createdAppointment?.id ?? payload?.id ?? String(Date.now()),
          groupId: resolvedGroupId || null,
          customerId: createdCustomerId,
          petId: createdPetId,
          customerName,
          petName,
          startTime: createdAppointment?.start_time ?? new Date(`${startTime}:00+09:00`).toISOString(),
          menuSummary: createdAppointment?.menu ?? menuOptions.filter((menu) => selectedMenuIds.includes(menu.id)).map((menu) => menu.name).join(' / '),
        },
        ...prev,
      ])
      setCurrentGroupId(resolvedGroupId)
      setSubmitMessage('予約を保存しました。同じ顧客の別のペット予約を続けて作成できます。')
    } catch {
      setSubmitError('通信エラーが発生しました。時間をおいて再度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinueWithAnotherPet = () => {
    setSelectedPetId('')
    setQuickPetName('')
    setQuickPetBreed('')
    setCopyMessage('')
    setSubmitError('')
    setSubmitMessage('別のペットを選んで続けて予約できます。')
  }

  const handleQrImageScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setQrMessage('')
    setQrError('')
    setQrDecoding(true)
    try {
      const detectorCtor = (globalThis as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector
      if (!detectorCtor) {
        throw new Error('このブラウザはQR画像読取に対応していません。')
      }
      const detector = new detectorCtor({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      const results = await detector.detect(bitmap)
      const raw = results[0]?.rawValue
      if (!raw) {
        throw new Error('QRコードを読み取れませんでした。')
      }
      const parsed = JSON.parse(raw) as QrPayload
      if (!parsed.customer_id || !parsed.pet_id) {
        throw new Error('QRデータ形式が不正です。')
      }

      const customerExists = customerList.some((customer) => customer.id === parsed.customer_id)
      const petExists = petList.some((pet) => pet.id === parsed.pet_id)
      if (!customerExists || !petExists) {
        throw new Error('この店舗の顧客/ペット情報と一致しません。')
      }

      handleCustomerChanged(parsed.customer_id)
      setSelectedPetId(parsed.pet_id)
      setQrMessage('QRコードから顧客・ペットを自動選択しました。')
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR読取に失敗しました。')
    } finally {
      setQrDecoding(false)
      event.target.value = ''
    }
  }

  const customerQueryNormalized = customerQuery.trim().toLowerCase()

  const filteredCustomers = useMemo(() => {
    if (!customerQueryNormalized || customerQueryNormalized.length < 2) {
      return customerList
    }

    const q = customerQuery.trim().toLowerCase()
    const matched = customerList.filter((customer) => customer.full_name.toLowerCase().includes(q))

    if (selectedCustomerId && !matched.some((customer) => customer.id === selectedCustomerId)) {
      const selected = customerList.find((customer) => customer.id === selectedCustomerId)
      return selected ? [selected, ...matched] : matched
    }

    return matched
  }, [customerList, customerQuery, customerQueryNormalized, selectedCustomerId])

  const filteredPets = useMemo(() => {
    if (!selectedCustomerId) return petList
    return petList.filter((pet) => pet.customer_id === selectedCustomerId)
  }, [petList, selectedCustomerId])

  const latestTemplate = useMemo(() => {
    const eligible = templates.filter((template) => {
      if (editAppointment && template.id === editAppointment.id) return false
      if (!selectedCustomerId || !selectedPetId) return false
      if (template.customer_id !== selectedCustomerId) return false
      if (template.pet_id !== selectedPetId) return false
      if (template.status === 'キャンセル' || template.status === '無断キャンセル') return false
      return true
    })
    if (eligible.length === 0) return null
    return eligible.sort((a, b) => {
      const aTime = a.start_time ? new Date(a.start_time).getTime() : 0
      const bTime = b.start_time ? new Date(b.start_time).getTime() : 0
      return bTime - aTime
    })[0]
  }, [templates, selectedCustomerId, selectedPetId, editAppointment])
  const selectedCustomerNoShowCount = selectedCustomerId
    ? customerNoShowCounts[selectedCustomerId] ?? 0
    : 0

  const handleCustomerChanged = (customerId: string) => {
    setSelectedCustomerId(customerId)
    if (!customerId) {
      setSelectedPetId('')
      return
    }
    const hasPet = petList.some((pet) => pet.id === selectedPetId && pet.customer_id === customerId)
    if (!hasPet) {
      setSelectedPetId('')
    }
  }

  const handleQuickCreate = async () => {
    const fullName = quickCustomerName.trim()
    const petName = quickPetName.trim()
    const breed = quickPetBreed.trim()
    const phoneNumber = quickCustomerPhone.trim()

    if (!fullName || !petName) {
      setQuickCreateError('顧客名とペット名は必須です。')
      return
    }

    setQuickCreateLoading(true)
    setQuickCreateError('')
    setQuickCreateMessage('')

    try {
      const customerResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phoneNumber || null,
        }),
      })

      if (!customerResponse.ok) {
        const payload = (await customerResponse.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? '顧客作成に失敗しました。')
      }

      const createdCustomer = (await customerResponse.json()) as { id: string; full_name: string }

      const petResponse = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: createdCustomer.id,
          name: petName,
          breed: breed || null,
        }),
      })

      if (!petResponse.ok) {
        const payload = (await petResponse.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? 'ペット作成に失敗しました。')
      }

      const createdPet = (await petResponse.json()) as { id: string; name: string; customer_id: string }

      setCustomerList((prev) => [{ id: createdCustomer.id, full_name: createdCustomer.full_name }, ...prev])
      setPetList((prev) => [{ id: createdPet.id, name: createdPet.name, customer_id: createdPet.customer_id }, ...prev])
      setSelectedCustomerId(createdCustomer.id)
      setSelectedPetId(createdPet.id)
      setCustomerQuery(createdCustomer.full_name)
      setQuickCustomerName('')
      setQuickCustomerPhone('')
      setQuickPetName('')
      setQuickPetBreed('')
      setQuickCreateMessage('顧客とペットを追加し、予約フォームに反映しました。')
    } catch (error) {
      setQuickCreateError(error instanceof Error ? error.message : '簡易作成に失敗しました。')
    } finally {
      setQuickCreateLoading(false)
    }
  }

  const handleCopyLatest = () => {
    if (!latestTemplate) {
      setCopyMessage('コピー元の前回予約が見つかりません。')
      return
    }

    if (latestTemplate.staff_id) {
      setSelectedStaffId(latestTemplate.staff_id)
    }
    setSelectedMenuIds(latestTemplate.menu_ids)
    setFieldChangeCount((prev) => prev + 1)
    if (!notes && latestTemplate.notes) {
      setNotes(latestTemplate.notes)
    }

    if (copyTimeMode === 'copy_full' && latestTemplate.start_time) {
      const copiedStart = new Date(latestTemplate.start_time)
      if (!Number.isNaN(copiedStart.getTime())) {
        setStartTime(toLocalInputValue(copiedStart))
      }
      if (latestTemplate.end_time) {
        const copiedEnd = new Date(latestTemplate.end_time)
        if (!Number.isNaN(copiedEnd.getTime())) {
          setEndTime(toLocalInputValue(copiedEnd))
        }
      }
    } else if (startTime) {
      const startDate = new Date(startTime)
      if (!Number.isNaN(startDate.getTime())) {
        const duration = Math.max(latestTemplate.duration ?? 0, 30)
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
        setEndTime(toLocalInputValue(endDate))
      }
    }

    setCopyMessage(
      copyTimeMode === 'copy_full'
        ? '前回の担当・メニュー・所要時間・時刻を反映しました。'
        : '前回の担当・メニュー・所要時間を反映しました。'
    )
  }

  return (
    <form
      action={formAction}
      method="post"
      className="space-y-4"
      onSubmit={handleSubmit}
    >
      {editAppointment && <input type="hidden" name="_method" value="put" />}
      {!editAppointment && currentGroupId ? <input type="hidden" name="group_id" value={currentGroupId} /> : null}
      {followupTaskId ? <input type="hidden" name="followup_task_id" value={followupTaskId} /> : null}
      {reofferId ? <input type="hidden" name="reoffer_id" value={reofferId} /> : null}
      {recommendationMessage ? (
        <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          {recommendationMessage}
        </div>
      ) : null}
      {selectedCustomerNoShowCount > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          注意: この顧客は無断キャンセル履歴が {selectedCustomerNoShowCount} 件あります。
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-4 ${singleColumn ? '' : 'md:grid-cols-2'}`}>
        <label className={`space-y-2 text-sm text-gray-700 ${singleColumn ? '' : 'md:col-span-2'}`}>
          QRコード画像から読取
          <input
            type="file"
            accept="image/*"
            onChange={handleQrImageScan}
            disabled={qrDecoding}
            className="w-full rounded border p-2 text-sm"
          />
          {qrDecoding ? <p className="text-xs text-gray-500">QR画像を解析中...</p> : null}
          {qrMessage ? <p className="text-xs text-emerald-700">{qrMessage}</p> : null}
          {qrError ? <p className="text-xs text-red-600">{qrError}</p> : null}
        </label>
        <label className={`space-y-2 text-sm text-gray-700 ${singleColumn ? '' : 'md:col-span-2'}`}>
          顧客検索
          <Input
            value={customerQuery}
            onChange={onInputChanged(setCustomerQuery)}
            placeholder="顧客名で検索（2文字以上）"
          />
          {customerQueryNormalized.length === 1 ? (
            <p className="text-xs text-gray-500">2文字以上で候補を絞り込みます。</p>
          ) : null}
        </label>
        <label className="space-y-2 text-sm text-gray-700">
          顧客
          <select
            name="customer_id"
            required
            value={selectedCustomerId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => handleCustomerChanged(event.target.value)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="" disabled>
              選択してください
            </option>
            {filteredCustomers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name}
                {(customerNoShowCounts[customer.id] ?? 0) > 0
                  ? `（無断CXL ${customerNoShowCounts[customer.id]}件）`
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <div
          className={`rounded border border-emerald-100 bg-emerald-50 p-3 text-sm ${
            singleColumn ? '' : 'md:col-span-2'
          }`}
        >
          <p className="font-semibold text-emerald-900">顧客・ペットをその場で簡易登録</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <Input
              value={quickCustomerName}
              onChange={onInputChanged(setQuickCustomerName)}
              placeholder="顧客名（必須）"
            />
            <Input
              value={quickPetName}
              onChange={onInputChanged(setQuickPetName)}
              placeholder="ペット名（必須）"
            />
            <Input
              value={quickCustomerPhone}
              onChange={onInputChanged(setQuickCustomerPhone)}
              placeholder="電話番号（任意）"
            />
            <Input
              value={quickPetBreed}
              onChange={onInputChanged(setQuickPetBreed)}
              placeholder="犬種（任意）"
            />
            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={handleQuickCreate}
                disabled={quickCreateLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {quickCreateLoading ? '登録中...' : '顧客+ペットを追加'}
              </Button>
            </div>
          </div>
          {quickCreateError ? <p className="mt-2 text-xs text-red-600">{quickCreateError}</p> : null}
          {quickCreateMessage ? <p className="mt-2 text-xs text-emerald-700">{quickCreateMessage}</p> : null}
        </div>
        <label className="space-y-2 text-sm text-gray-700">
          ペット
          <select
            name="pet_id"
            required
            value={selectedPetId}
            onChange={onSelectChanged(setSelectedPetId)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="" disabled>
              選択してください
            </option>
            {filteredPets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className={`rounded border border-blue-100 bg-blue-50 p-3 text-sm ${
            singleColumn ? '' : 'md:col-span-2'
          }`}
        >
          <p className="font-semibold text-blue-900">前回内容コピー</p>
          <p className="text-blue-700">
            顧客とペットを選ぶと、前回予約から担当・メニュー・所要時間をコピーできます。
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-blue-800">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="copy_time_mode"
                checked={copyTimeMode === 'keep_start'}
                onChange={() => setCopyTimeMode('keep_start')}
              />
              開始時刻は現在入力を維持
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="copy_time_mode"
                checked={copyTimeMode === 'copy_full'}
                onChange={() => setCopyTimeMode('copy_full')}
              />
              前回の時刻もコピー
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleCopyLatest} className="bg-sky-600 hover:bg-sky-700">
              前回内容をコピー
            </Button>
            {latestTemplate ? (
              <span className="text-xs text-blue-700">前回予約が見つかりました。</span>
            ) : (
              <span className="text-xs text-blue-700">コピー可能な前回予約はありません。</span>
            )}
          </div>
          {copyMessage ? <p className="mt-2 text-xs text-blue-800">{copyMessage}</p> : null}
        </div>
        <div className={`space-y-2 text-sm text-gray-700 ${singleColumn ? '' : 'md:col-span-2'}`}>
          <p>予約メニュー (複数選択)</p>
          <AppointmentMenuSelector
            menus={menuOptions}
            selectedIds={selectedMenuIds}
            defaultSelectedIds={selectedMenuIds}
            startInputId="appointment_start_time"
            endInputId="appointment_end_time"
            onSelectedIdsChange={(ids) => {
              setSelectedMenuIds(ids)
              setFieldChangeCount((prev) => prev + 1)
            }}
          />
        </div>
        <label className="space-y-2 text-sm text-gray-700">
          予約開始日時
          <Input
            id="appointment_start_time"
            type="datetime-local"
            name="start_time"
            required
            value={startTime}
            onChange={onInputChanged(setStartTime)}
          />
        </label>
        <label className="space-y-2 text-sm text-gray-700">
          予約終了日時
          <Input
            id="appointment_end_time"
            type="datetime-local"
            name="end_time"
            required
            value={endTime}
            onChange={onInputChanged(setEndTime)}
            readOnly
            className="bg-gray-50 text-gray-600"
          />
          <p className="text-xs text-gray-500">
            開始日時とメニュー所要時間から自動計算します。保存時もサーバー側で再計算されます。
          </p>
        </label>
        <label className="space-y-2 text-sm text-gray-700">
          担当スタッフ
          <select
            name="staff_id"
            required
            value={selectedStaffId}
            onChange={onSelectChanged(setSelectedStaffId)}
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
          ステータス
          <select
            name="status"
            value={status}
            onChange={onSelectChanged(setStatus)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-gray-700">
          予約時の決済
          <select
            name="reservation_payment_method"
            value={reservationPaymentMethod}
            onChange={onSelectChanged(setReservationPaymentMethod)}
            className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="none">現地会計のみ</option>
            {reservationPaymentSettings.prepayment_enabled || reservationPaymentMethod === 'prepayment' ? (
              <option value="prepayment">事前決済</option>
            ) : null}
            {reservationPaymentSettings.card_hold_enabled || reservationPaymentMethod === 'card_hold' ? (
              <option value="card_hold">カード仮押さえ</option>
            ) : null}
          </select>
          <p className="text-xs text-gray-500">
            前日 {reservationPaymentSettings.cancellation_day_before_percent}% / 当日{' '}
            {reservationPaymentSettings.cancellation_same_day_percent}% / 無断キャンセル{' '}
            {reservationPaymentSettings.cancellation_no_show_percent}% を設定反映
          </p>
        </label>
        <label className={`space-y-2 text-sm text-gray-700 ${singleColumn ? '' : 'md:col-span-2'}`}>
          備考
          <Input
            name="notes"
            value={notes}
            onChange={onInputChanged(setNotes)}
            placeholder="連絡事項など"
          />
        </label>
      </div>
      {submitError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}
      {submitMessage ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {submitMessage}
        </div>
      ) : null}
      {createdAppointments.length > 0 ? (
        <div
          ref={createdAppointmentsRef}
          className="space-y-3 rounded border border-sky-200 bg-sky-50 p-3 ring-2 ring-sky-100"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-sky-900">家族単位の作成確認</p>
              <p className="text-xs text-sky-700">
                1頭目の保存後は、ここから「別のペットを続けて予約」に進みます。
              </p>
            </div>
            {!editAppointment ? (
              <Button type="button" onClick={handleContinueWithAnotherPet} className="bg-sky-700 hover:bg-sky-800">
                別のペットを続けて予約
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            {createdAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded border border-sky-100 bg-white px-3 py-2 text-sm text-sky-950">
                <p className="font-semibold">
                  {appointment.customerName} / {appointment.petName}
                </p>
                <p>開始: {formatDateTimeJst(appointment.startTime)}</p>
                <p>メニュー: {appointment.menuSummary || '未設定'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? '保存中...' : editAppointment ? '更新する' : '登録する'}
        </Button>
        {editAppointment && (
          <Link href={cancelHref} className="text-sm text-gray-500">
            編集をやめる
          </Link>
        )}
      </div>
    </form>
  )
}
