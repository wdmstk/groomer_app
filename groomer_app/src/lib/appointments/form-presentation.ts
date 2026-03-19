export type AppointmentFormTemplate = {
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

export type AppointmentFormConflictPayload = {
  message?: string
  conflict?: {
    startTime?: string | null
    endTime?: string | null
  } | null
} | null

export type AppointmentFormCreatedPayload = {
  id?: string
  groupId?: string | null
  appointment?: {
    id?: string
    group_id?: string | null
    customer_id?: string | null
    pet_id?: string | null
    start_time?: string | null
    menu?: string | null
  } | null
} | null

export type CreatedAppointmentSummary = {
  id: string
  groupId: string | null
  customerId: string
  petId: string
  customerName: string
  petName: string
  startTime: string
  menuSummary: string
}

export function formatAppointmentFormDateTimeJst(value: string | null | undefined) {
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

export function buildAppointmentConflictMessage(payload: AppointmentFormConflictPayload) {
  if (payload?.conflict?.startTime || payload?.conflict?.endTime) {
    return (
      `${payload?.message ?? '同じスタッフに時間が重複する予約があります。'} ` +
      `衝突: ${formatAppointmentFormDateTimeJst(payload.conflict.startTime)} - ${formatAppointmentFormDateTimeJst(payload.conflict.endTime)}`
    )
  }

  return payload?.message ?? '同じスタッフに時間が重複する予約があります。'
}

export function selectLatestReservableTemplate(params: {
  templates: AppointmentFormTemplate[]
  selectedCustomerId: string
  selectedPetId: string
  editingAppointmentId?: string | null
}) {
  const eligible = params.templates.filter((template) => {
    if (params.editingAppointmentId && template.id === params.editingAppointmentId) return false
    if (!params.selectedCustomerId || !params.selectedPetId) return false
    if (template.customer_id !== params.selectedCustomerId) return false
    if (template.pet_id !== params.selectedPetId) return false
    if (template.status === 'キャンセル' || template.status === '無断キャンセル') return false
    return true
  })

  if (eligible.length === 0) return null

  return eligible.sort((a, b) => {
    const aTime = a.start_time ? new Date(a.start_time).getTime() : 0
    const bTime = b.start_time ? new Date(b.start_time).getTime() : 0
    return bTime - aTime
  })[0]
}

export function buildCreatedAppointmentSummary(params: {
  payload: AppointmentFormCreatedPayload
  currentGroupId: string
  selectedCustomerId: string
  selectedPetId: string
  startTime: string
  selectedMenuIds: string[]
  menuOptions: Array<{ id: string; name: string }>
  customerList: Array<{ id: string; full_name: string }>
  petList: Array<{ id: string; name: string }>
  nowId?: string
}) {
  const createdAppointment = params.payload?.appointment
  const resolvedGroupId =
    createdAppointment?.group_id ?? params.payload?.groupId ?? params.currentGroupId ?? ''
  const createdCustomerId = createdAppointment?.customer_id ?? params.selectedCustomerId
  const createdPetId = createdAppointment?.pet_id ?? params.selectedPetId
  const customerName =
    params.customerList.find((customer) => customer.id === createdCustomerId)?.full_name ?? '顧客'
  const petName = params.petList.find((pet) => pet.id === createdPetId)?.name ?? 'ペット'

  return {
    id: createdAppointment?.id ?? params.payload?.id ?? params.nowId ?? String(Date.now()),
    groupId: resolvedGroupId || null,
    customerId: createdCustomerId,
    petId: createdPetId,
    customerName,
    petName,
    startTime:
      createdAppointment?.start_time ?? new Date(`${params.startTime}:00+09:00`).toISOString(),
    menuSummary:
      createdAppointment?.menu ??
      params.menuOptions
        .filter((menu) => params.selectedMenuIds.includes(menu.id))
        .map((menu) => menu.name)
        .join(' / '),
  } satisfies CreatedAppointmentSummary
}
