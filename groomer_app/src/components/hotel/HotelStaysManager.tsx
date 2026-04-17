'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useDismissibleModal } from '@/hooks/useDismissibleModal'

type Option = {
  id: string
  label: string
  customer_id?: string
}

type StayItemRow = {
  id: string
  menu_item_id: string | null
  item_type: string
  label_snapshot: string
  billing_unit_snapshot: string
  quantity: number
  unit_price_snapshot: number
  line_amount_jpy: number
  counts_toward_capacity: boolean
  sort_order: number
  notes: string | null
}

type StayRow = {
  id: string
  stay_code: string
  status: string
  customer_id: string | null
  appointment_id?: string | null
  pet_id: string
  planned_check_in_at: string
  planned_check_out_at: string
  actual_check_in_at: string | null
  actual_check_out_at: string | null
  nights: number
  pickup_required: boolean
  dropoff_required: boolean
  vaccine_expires_on: string | null
  total_amount_jpy: number
  notes: string | null
  selected_items?: StayItemRow[]
}

type HotelMenuItemRow = {
  id: string
  name: string
  item_type: string
  billing_unit: string
  duration_minutes: number | null
  default_quantity: number
  price: number
  tax_rate: number
  tax_included: boolean
  counts_toward_capacity: boolean
  is_active: boolean
  display_order: number
  notes: string | null
}

type HotelSettingsRow = {
  id: string | null
  store_id: string
  max_concurrent_pets: number
  calendar_open_hour: number | null
  calendar_close_hour: number | null
}

type Props = {
  initialStays: StayRow[]
  customers: Option[]
  pets: Option[]
  menuItems: HotelMenuItemRow[]
  initialSettings: HotelSettingsRow
  initialStayId?: string
}

type ViewMode = 'week' | 'day' | 'month'
type TabId = 'list' | 'calendar' | 'settings' | 'menus'
type ReservationMode = 'create' | 'edit' | null

type SelectedItemInput = {
  menu_item_id: string
  quantity: number
}

type StayPayload = {
  stay_code: string
  customer_id: string | null
  pet_id: string
  status: 'reserved' | 'checked_in' | 'checked_out' | 'canceled' | 'no_show'
  planned_check_in_at: string
  planned_check_out_at: string
  actual_check_in_at: string | null
  actual_check_out_at: string | null
  nights: number
  vaccine_expires_on: string | null
  notes: string | null
  selected_items: SelectedItemInput[]
}

type MenuItemDraft = {
  id: string | null
  name: string
  item_type: string
  billing_unit: string
  duration_minutes: string
  default_quantity: string
  price: string
  tax_rate: string
  tax_included: boolean
  counts_toward_capacity: boolean
  is_active: boolean
  display_order: string
  notes: string
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function statusLabel(status: StayPayload['status'] | string) {
  if (status === 'reserved') return '予約済み'
  if (status === 'checked_in') return 'チェックイン済み'
  if (status === 'checked_out') return 'チェックアウト済み'
  if (status === 'canceled') return 'キャンセル'
  if (status === 'no_show') return '無断キャンセル'
  return status
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
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

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatMoney(value: number) {
  return `${value.toLocaleString()} 円`
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return parts.replace(' ', 'T')
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return null
  const date = new Date(`${value}:00+09:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function addMinutesToDateTimeLocalValue(value: string, minutes: number) {
  if (!value) return value
  const date = new Date(`${value}:00+09:00`)
  if (Number.isNaN(date.getTime())) return value
  date.setMinutes(date.getMinutes() + minutes)
  return toDateTimeLocalValue(date.toISOString())
}

function getJstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  }
}

function createDateFromJst(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - JST_OFFSET_MS)
}

function startOfJstDay(date: Date) {
  const parts = getJstParts(date)
  return createDateFromJst(parts.year, parts.month, parts.day)
}

function addDaysJst(date: Date, days: number) {
  const parts = getJstParts(date)
  return createDateFromJst(parts.year, parts.month, parts.day + days, parts.hour, parts.minute)
}

function toJstDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = getJstParts(date)
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getWeekStart(date: Date) {
  const parts = getJstParts(date)
  const mondayOffset = parts.weekday === 0 ? -6 : 1 - parts.weekday
  return startOfJstDay(addDaysJst(date, mondayOffset))
}

function getMonthGridStart(date: Date) {
  const parts = getJstParts(date)
  return getWeekStart(createDateFromJst(parts.year, parts.month, 1))
}

function getMinutesFromDayStart(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const parts = getJstParts(date)
  return parts.hour * 60 + parts.minute
}

function calculateNights(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 1
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

function buildEmptyPayload(defaultPetId: string): StayPayload {
  const now = new Date()
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const toLocal = (date: Date) => {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
    return parts.replace(' ', 'T')
  }

  return {
    stay_code: '',
    customer_id: null,
    pet_id: defaultPetId,
    status: 'reserved',
    planned_check_in_at: toLocal(now),
    planned_check_out_at: toLocal(end),
    actual_check_in_at: null,
    actual_check_out_at: null,
    nights: 1,
    vaccine_expires_on: null,
    notes: null,
    selected_items: [],
  }
}

function payloadFromStay(stay: StayRow): StayPayload {
  return {
    stay_code: stay.stay_code,
    customer_id: stay.customer_id,
    pet_id: stay.pet_id,
    status: (stay.status as StayPayload['status']) ?? 'reserved',
    planned_check_in_at: toDateTimeLocalValue(stay.planned_check_in_at),
    planned_check_out_at: toDateTimeLocalValue(stay.planned_check_out_at),
    actual_check_in_at: toDateTimeLocalValue(stay.actual_check_in_at),
    actual_check_out_at: toDateTimeLocalValue(stay.actual_check_out_at),
    nights: stay.nights,
    vaccine_expires_on: stay.vaccine_expires_on,
    notes: stay.notes,
    selected_items: (stay.selected_items ?? [])
      .map((item) =>
        item.menu_item_id
          ? {
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
            }
          : null
      )
      .filter((item): item is SelectedItemInput => Boolean(item)),
  }
}

function buildMenuItemDraft(item?: HotelMenuItemRow | null): MenuItemDraft {
  return {
    id: item?.id ?? null,
    name: item?.name ?? '',
    item_type: item?.item_type ?? 'option',
    billing_unit: item?.billing_unit ?? 'fixed',
    duration_minutes: item?.duration_minutes?.toString() ?? '',
    default_quantity: Math.max(1, Math.floor(item?.default_quantity ?? 1)).toString(),
    price: item?.price?.toString() ?? '0',
    tax_rate: item?.tax_rate?.toString() ?? '0.1',
    tax_included: item?.tax_included ?? true,
    counts_toward_capacity: item?.counts_toward_capacity ?? false,
    is_active: item?.is_active ?? true,
    display_order: item?.display_order?.toString() ?? '0',
    notes: item?.notes ?? '',
  }
}

function intersects(rangeStart: string, rangeEnd: string, targetStart: string, targetEnd: string) {
  return (
    new Date(targetStart).getTime() < new Date(rangeEnd).getTime() &&
    new Date(targetEnd).getTime() > new Date(rangeStart).getTime()
  )
}

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getVisibleStayWindow(
  stay: Pick<StayRow, 'planned_check_in_at' | 'planned_check_out_at'>,
  day: Date,
  openHour: number,
  closeHour: number
) {
  const dayParts = getJstParts(day)
  const dayStart = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, openHour)
  const dayEnd = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, closeHour + 1)
  const stayStart = new Date(stay.planned_check_in_at)
  const stayEnd = new Date(stay.planned_check_out_at)
  const visibleStart = new Date(Math.max(stayStart.getTime(), dayStart.getTime()))
  const visibleEnd = new Date(Math.min(stayEnd.getTime(), dayEnd.getTime()))

  return {
    visibleStart,
    visibleEnd,
  }
}

function sortStays(rows: StayRow[]) {
  return [...rows].sort(
    (left, right) => new Date(right.planned_check_in_at).getTime() - new Date(left.planned_check_in_at).getTime()
  )
}

export function HotelStaysManager({
  initialStays,
  customers,
  pets,
  menuItems: initialMenuItems,
  initialSettings,
  initialStayId,
}: Props) {
  const initialSelectedStayId =
    (initialStayId && initialStays.some((stay) => stay.id === initialStayId) ? initialStayId : null) ??
    initialStays[0]?.id ??
    null
  const [stays, setStays] = useState<StayRow[]>(initialStays)
  const [menuItems, setMenuItems] = useState<HotelMenuItemRow[]>(initialMenuItems)
  const [settings, setSettings] = useState<HotelSettingsRow>(initialSettings)
  const [activeTab, setActiveTab] = useState<TabId>('list')
  const [selectedStayId, setSelectedStayId] = useState<string | null>(initialSelectedStayId)
  const [reservationMode, setReservationMode] = useState<ReservationMode>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null)
  const [savingMenuItem, setSavingMenuItem] = useState(false)
  const [deletingMenuItemId, setDeletingMenuItemId] = useState<string | null>(null)
  const [seasonSwitchingMode, setSeasonSwitchingMode] = useState<'normal' | 'high_season' | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [showMenuItemForm, setShowMenuItemForm] = useState(false)
  const [menuItemDraft, setMenuItemDraft] = useState<MenuItemDraft>(() => buildMenuItemDraft())
  const [form, setForm] = useState<StayPayload>(buildEmptyPayload(pets[0]?.id ?? ''))

  const selectedStay = useMemo(
    () => stays.find((stay) => stay.id === selectedStayId) ?? null,
    [stays, selectedStayId]
  )
  const filteredPets = useMemo(() => {
    if (!form.customer_id) return pets
    return pets.filter((pet) => pet.customer_id === form.customer_id)
  }, [pets, form.customer_id])
  const activeMenuItems = useMemo(
    () => menuItems.filter((item) => item.is_active).sort((a, b) => a.display_order - b.display_order),
    [menuItems]
  )
  const normalMenuCount = useMemo(
    () => menuItems.filter((item) => item.display_order >= 10 && item.display_order <= 199).length,
    [menuItems]
  )
  const highSeasonMenuCount = useMemo(
    () => menuItems.filter((item) => item.display_order >= 300 && item.display_order <= 499).length,
    [menuItems]
  )
  const selectedItemsMap = useMemo(
    () => new Map(form.selected_items.map((item) => [item.menu_item_id, item.quantity])),
    [form.selected_items]
  )
  const selectedTimePack = useMemo(
    () =>
      form.selected_items
        .map((selectedItem) => menuItems.find((item) => item.id === selectedItem.menu_item_id) ?? null)
        .find((item) => item?.item_type === 'time_pack' && (item.duration_minutes ?? 0) > 0) ?? null,
    [form.selected_items, menuItems]
  )
  const estimatedTotal = useMemo(
    () =>
      form.selected_items.reduce((sum, item) => {
        const menuItem = menuItems.find((row) => row.id === item.menu_item_id)
        if (!menuItem) return sum
        const effectiveQuantity =
          menuItem.billing_unit === 'per_night'
            ? form.nights
            : menuItem.billing_unit === 'per_stay' || menuItem.billing_unit === 'fixed'
              ? 1
              : item.quantity
        return sum + Math.round(menuItem.price * effectiveQuantity)
      }, 0),
    [form.nights, form.selected_items, menuItems]
  )

  const dayHours = useMemo(() => {
    const start = settings.calendar_open_hour ?? 8
    const end = settings.calendar_close_hour ?? 20
    const list: number[] = []
    for (let hour = start; hour <= end; hour += 1) list.push(hour)
    return list
  }, [settings.calendar_close_hour, settings.calendar_open_hour])

  const weekDays = useMemo(() => {
    const start = getWeekStart(anchorDate)
    return Array.from({ length: 7 }, (_, index) => addDaysJst(start, index))
  }, [anchorDate])

  const dayStart = useMemo(() => startOfJstDay(anchorDate), [anchorDate])
  const calendarDays = useMemo(() => {
    if (viewMode === 'day') return [dayStart]
    if (viewMode === 'week') return weekDays
    const start = getMonthGridStart(anchorDate)
    return Array.from({ length: 42 }, (_, index) => addDaysJst(start, index))
  }, [anchorDate, dayStart, viewMode, weekDays])

  const staysByDay = useMemo(() => {
    const map = new Map<string, StayRow[]>()
    calendarDays.forEach((day) => map.set(toJstDateKey(day), []))

    stays.forEach((stay) => {
      calendarDays.forEach((day) => {
        const key = toJstDateKey(day)
        const dayStartIso = day.toISOString()
        const dayEndIso = addDaysJst(day, 1).toISOString()
        if (intersects(dayStartIso, dayEndIso, stay.planned_check_in_at, stay.planned_check_out_at)) {
          const current = map.get(key) ?? []
          current.push(stay)
          map.set(key, current)
        }
      })
    })
    return map
  }, [calendarDays, stays])

  const closeReservationModal = useCallback(() => {
    setReservationMode(null)
  }, [])

  const { modalPanelRef, handleBackdropClick } = useDismissibleModal({
    open: reservationMode !== null,
    onClose: closeReservationModal,
  })

  useEffect(() => {
    if (!selectedTimePack?.duration_minutes || !form.planned_check_in_at) return
    const nextCheckOutAt = addMinutesToDateTimeLocalValue(form.planned_check_in_at, selectedTimePack.duration_minutes)
    if (!nextCheckOutAt || nextCheckOutAt === form.planned_check_out_at) return
    setForm((prev) => {
      if (prev.planned_check_in_at !== form.planned_check_in_at) return prev
      return {
        ...prev,
        planned_check_out_at: nextCheckOutAt,
        nights: calculateNights(prev.planned_check_in_at, nextCheckOutAt),
      }
    })
  }, [form.planned_check_in_at, form.planned_check_out_at, selectedTimePack?.duration_minutes])

  useEffect(() => {
    if (!initialStayId) return
    if (!stays.some((stay) => stay.id === initialStayId)) return
    setSelectedStayId(initialStayId)
    setActiveTab('list')
  }, [initialStayId, stays])

  async function reloadAll() {
    const [staysResponse, itemsResponse, settingsResponse] = await Promise.all([
      fetch('/api/hotel/stays?include_items=true'),
      fetch('/api/hotel/menu-items'),
      fetch('/api/hotel/settings'),
    ])

    const staysBody = (await staysResponse.json().catch(() => null)) as { stays?: StayRow[]; message?: string } | null
    const itemsBody = (await itemsResponse.json().catch(() => null)) as
      | { menu_items?: HotelMenuItemRow[]; message?: string }
      | null
    const settingsBody = (await settingsResponse.json().catch(() => null)) as
      | { settings?: HotelSettingsRow; message?: string }
      | null

    if (!staysResponse.ok || !staysBody?.stays) {
      throw new Error(staysBody?.message ?? 'ホテル台帳の再取得に失敗しました。')
    }
    if (!itemsResponse.ok || !itemsBody?.menu_items) {
      throw new Error(itemsBody?.message ?? 'ホテル商品台帳の再取得に失敗しました。')
    }
    if (!settingsResponse.ok || !settingsBody?.settings) {
      throw new Error(settingsBody?.message ?? 'ホテル設定の再取得に失敗しました。')
    }

    setStays(staysBody.stays)
    setMenuItems(itemsBody.menu_items)
    setSettings(settingsBody.settings)
  }

  async function fetchStayById(stayId: string) {
    const response = await fetch(`/api/hotel/stays/${stayId}`)
    const body = (await response.json().catch(() => null)) as { stay?: StayRow; message?: string } | null
    if (!response.ok || !body?.stay) {
      throw new Error(body?.message ?? 'ホテル予約の取得に失敗しました。')
    }
    return body.stay
  }

  function openCreate() {
    setForm(buildEmptyPayload(pets[0]?.id ?? ''))
    setReservationMode('create')
    setMessage('')
  }

  function openEdit(stayId: string) {
    const stay = stays.find((item) => item.id === stayId)
    if (!stay) return
    setSelectedStayId(stayId)
    setForm(payloadFromStay(stay))
    setReservationMode('edit')
    setMessage('')
  }

  function handleCustomerChanged(customerId: string | null) {
    setForm((prev) => {
      const nextCustomerId = customerId && customerId.length > 0 ? customerId : null
      if (!nextCustomerId) {
        return { ...prev, customer_id: null, pet_id: '' }
      }
      const currentPet = pets.find((pet) => pet.id === prev.pet_id)
      if (!currentPet || currentPet.customer_id !== nextCustomerId) {
        return { ...prev, customer_id: nextCustomerId, pet_id: '' }
      }
      return { ...prev, customer_id: nextCustomerId }
    })
  }

  function handlePetChanged(petId: string) {
    const selectedPet = pets.find((pet) => pet.id === petId)
    setForm((prev) => ({
      ...prev,
      pet_id: petId,
      customer_id: selectedPet?.customer_id ?? prev.customer_id,
    }))
  }

  function toggleSelectedItem(menuItemId: string, checked: boolean) {
    setForm((prev) => {
      if (checked) {
        const menuItem = menuItems.find((item) => item.id === menuItemId)
        if (!menuItem) return prev
        return {
          ...prev,
          selected_items: [
            ...prev.selected_items.filter((item) => item.menu_item_id !== menuItemId),
            {
              menu_item_id: menuItemId,
              quantity:
                menuItem.billing_unit === 'per_hour'
                  ? Math.max(1, Math.floor(menuItem.default_quantity || 1))
                  : 1,
            },
          ],
        }
      }
      return {
        ...prev,
        selected_items: prev.selected_items.filter((item) => item.menu_item_id !== menuItemId),
      }
    })
  }

  function setSelectedItemQuantity(menuItemId: string, quantity: number) {
    setForm((prev) => ({
      ...prev,
      selected_items: prev.selected_items.map((item) =>
        item.menu_item_id === menuItemId ? { ...item, quantity: Math.max(1, Math.floor(quantity || 1)) } : item
      ),
    }))
  }

  async function submitCreate() {
    if (!form.pet_id) {
      setMessage('ペットを選択してください。')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/hotel/stays', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nights: calculateNights(form.planned_check_in_at, form.planned_check_out_at),
          planned_check_in_at: fromDateTimeLocalValue(form.planned_check_in_at),
          planned_check_out_at: fromDateTimeLocalValue(form.planned_check_out_at),
          actual_check_in_at: fromDateTimeLocalValue(form.actual_check_in_at ?? ''),
          actual_check_out_at: fromDateTimeLocalValue(form.actual_check_out_at ?? ''),
        }),
      })
      const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '新規作成に失敗しました。')
      }
      const createdStay = body?.id ? await fetchStayById(body.id) : null
      if (createdStay) {
        setStays((prev) => sortStays([createdStay, ...prev.filter((stay) => stay.id !== createdStay.id)]))
        setSelectedStayId(createdStay.id)
      }
      setReservationMode(null)
      setMessage('ホテル台帳を作成しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '新規作成に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function submitUpdate() {
    if (!selectedStayId) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/hotel/stays/${selectedStayId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nights: calculateNights(form.planned_check_in_at, form.planned_check_out_at),
          planned_check_in_at: fromDateTimeLocalValue(form.planned_check_in_at),
          planned_check_out_at: fromDateTimeLocalValue(form.planned_check_out_at),
          actual_check_in_at: fromDateTimeLocalValue(form.actual_check_in_at ?? ''),
          actual_check_out_at: fromDateTimeLocalValue(form.actual_check_out_at ?? ''),
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '更新に失敗しました。')
      }
      if (selectedStayId) {
        const updatedStay = await fetchStayById(selectedStayId)
        setStays((prev) => sortStays(prev.map((stay) => (stay.id === updatedStay.id ? updatedStay : stay))))
      }
      setReservationMode(null)
      setMessage('ホテル台帳を更新しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function submitDelete() {
    if (!selectedStayId) return
    if (!window.confirm('このホテル台帳を削除しますか？')) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/hotel/stays/${selectedStayId}`, {
        method: 'DELETE',
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '削除に失敗しました。')
      }
      const remainingStays = stays.filter((stay) => stay.id !== selectedStayId)
      setStays(remainingStays)
      setSelectedStayId(remainingStays[0]?.id ?? null)
      setReservationMode(null)
      setForm(buildEmptyPayload(pets[0]?.id ?? ''))
      setMessage('ホテル台帳を削除しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '削除に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function createUnifiedInvoiceFromSelectedStay() {
    if (!selectedStay) return
    if (!selectedStay.customer_id) {
      setMessage('顧客情報が未設定の宿泊予約は統合会計を作成できません。')
      return
    }

    setCreatingInvoice(true)
    setMessage('')
    setInvoiceMessage(null)
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedStay.customer_id,
          appointment_ids: selectedStay.appointment_id ? [selectedStay.appointment_id] : [],
          hotel_stay_ids: [selectedStay.id],
          notes: `ホテル統合会計: ${selectedStay.stay_code}`,
        }),
      })
      const body = (await response.json().catch(() => null)) as { invoice?: { id?: string }; message?: string } | null
      if (!response.ok || !body?.invoice?.id) {
        throw new Error(body?.message ?? '統合会計の作成に失敗しました。')
      }
      setInvoiceMessage(`統合会計を作成しました（請求ID: ${body.invoice.id}）。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '統合会計の作成に失敗しました。')
    } finally {
      setCreatingInvoice(false)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    setMessage('')
    try {
      const response = await fetch('/api/hotel/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const body = (await response.json().catch(() => null)) as { settings?: HotelSettingsRow; message?: string } | null
      if (!response.ok || !body?.settings) {
        throw new Error(body?.message ?? '設定保存に失敗しました。')
      }
      setSettings(body.settings)
      setMessage('ホテル設定を保存しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '設定保存に失敗しました。')
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveMenuItem() {
    setSavingMenuItem(true)
    setMessage('')
    try {
      const response = await fetch(
        menuItemDraft.id ? `/api/hotel/menu-items/${menuItemDraft.id}` : '/api/hotel/menu-items',
        {
          method: menuItemDraft.id ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...menuItemDraft,
            duration_minutes: menuItemDraft.duration_minutes ? Number(menuItemDraft.duration_minutes) : null,
            default_quantity: Math.max(1, Math.floor(Number(menuItemDraft.default_quantity) || 1)),
            price: Number(menuItemDraft.price) || 0,
            tax_rate: Number(menuItemDraft.tax_rate) || 0.1,
            display_order: Number(menuItemDraft.display_order) || 0,
          }),
        }
      )
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '商品保存に失敗しました。')
      }
      await reloadAll()
      setMenuItemDraft(buildMenuItemDraft())
      setShowMenuItemForm(false)
      setMessage('ホテル商品を保存しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '商品保存に失敗しました。')
    } finally {
      setSavingMenuItem(false)
    }
  }

  async function deleteMenuItem(itemId: string) {
    if (!window.confirm('この商品を削除しますか？')) return
    setDeletingMenuItemId(itemId)
    setMessage('')
    try {
      const response = await fetch(`/api/hotel/menu-items/${itemId}`, { method: 'DELETE' })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? '商品削除に失敗しました。')
      }
      await reloadAll()
      setMessage('ホテル商品を削除しました。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '商品削除に失敗しました。')
    } finally {
      setDeletingMenuItemId(null)
    }
  }

  async function switchSeasonMode(seasonMode: 'normal' | 'high_season') {
    setSeasonSwitchingMode(seasonMode)
    setMessage('')
    try {
      const response = await fetch('/api/hotel/menu-items/season-toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season_mode: seasonMode }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(body?.message ?? 'シーズン切替に失敗しました。')
      }
      await reloadAll()
      setMessage(
        body?.message ??
          (seasonMode === 'high_season'
            ? 'ハイシーズンメニューへ切り替えました。'
            : '通常メニューへ切り替えました。')
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'シーズン切替に失敗しました。')
    } finally {
      setSeasonSwitchingMode(null)
    }
  }

  function shiftCalendar(step: number) {
    if (viewMode === 'day') {
      setAnchorDate((prev) => addDaysJst(prev, step))
      return
    }
    if (viewMode === 'week') {
      setAnchorDate((prev) => addDaysJst(prev, step * 7))
      return
    }
    const parts = getJstParts(anchorDate)
    setAnchorDate(createDateFromJst(parts.year, parts.month + step, 1))
  }

  function renderReservationForm() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            台帳コード
            <input
              type="text"
              value={form.stay_code}
              onChange={(event) => setForm((prev) => ({ ...prev, stay_code: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="未入力で自動採番"
            />
          </label>
          <label className="text-sm text-gray-700">
            ステータス
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as StayPayload['status'] }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="reserved">予約済み</option>
              <option value="checked_in">チェックイン済み</option>
              <option value="checked_out">チェックアウト済み</option>
              <option value="canceled">キャンセル</option>
              <option value="no_show">無断キャンセル</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            顧客
            <select
              value={form.customer_id ?? ''}
              onChange={(event) => handleCustomerChanged(event.target.value || null)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">未選択</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            ペット
            <select
              value={form.pet_id}
              onChange={(event) => handlePetChanged(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">選択してください</option>
              {filteredPets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            予定チェックイン
            <input
              type="datetime-local"
              value={form.planned_check_in_at}
              onChange={(event) => setForm((prev) => ({ ...prev, planned_check_in_at: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            予定チェックアウト
            <input
              type="datetime-local"
              value={form.planned_check_out_at}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  planned_check_out_at: event.target.value,
                  nights: calculateNights(prev.planned_check_in_at, event.target.value),
                }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            実績チェックイン
            <input
              type="datetime-local"
              value={form.actual_check_in_at ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, actual_check_in_at: event.target.value || null }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            実績チェックアウト
            <input
              type="datetime-local"
              value={form.actual_check_out_at ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, actual_check_out_at: event.target.value || null }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            ワクチン期限
            <input
              type="date"
              value={form.vaccine_expires_on ?? ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, vaccine_expires_on: event.target.value || null }))
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            泊数
            <input
              type="number"
              min={1}
              value={form.nights}
              readOnly
              className="mt-1 w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-500">チェックイン/チェックアウトから自動計算されます。</p>
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            備考
            <textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value || null }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">利用プラン・オプション</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeMenuItems.map((item) => {
              const quantity = selectedItemsMap.get(item.id)
              const effectiveQuantity =
                item.billing_unit === 'per_night'
                  ? form.nights
                  : item.billing_unit === 'per_stay' || item.billing_unit === 'fixed'
                    ? 1
                    : quantity ?? 1
              const canEditQuantity = item.billing_unit === 'per_hour'
              return (
                <div key={item.id} className="rounded border border-gray-200 p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={quantity !== undefined}
                      onChange={(event) => toggleSelectedItem(item.id, event.target.checked)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-700">{formatMoney(item.price)}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {item.item_type} / {item.billing_unit}
                        {item.counts_toward_capacity ? ' / 定員対象' : ''}
                      </p>
                      {quantity !== undefined ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {item.billing_unit === 'per_night'
                              ? '泊数'
                              : item.billing_unit === 'per_hour'
                                ? '数量'
                                : '数量'}
                          </span>
                          {canEditQuantity ? (
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={quantity}
                              onChange={(event) => setSelectedItemQuantity(item.id, Number(event.target.value) || 1)}
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="inline-flex min-w-24 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700">
                              {effectiveQuantity}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-gray-700">
                            {formatMoney(Math.round(item.price * effectiveQuantity))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </label>
                </div>
              )
            })}
          </div>
          <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
            <p className="font-semibold text-gray-900">見積合計: {formatMoney(estimatedTotal)}</p>
            <p className="mt-1 text-xs text-gray-500">
              送迎は商品選択から自動判定します。予約時点の商品・単価を明細保存します。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {reservationMode === 'create' ? (
            <Button type="button" onClick={() => void submitCreate()} disabled={saving}>
              {saving ? '作成中...' : '作成'}
            </Button>
          ) : (
            <>
              <Button type="button" onClick={() => void submitUpdate()} disabled={saving || !selectedStayId}>
                {saving ? '更新中...' : '更新'}
              </Button>
              <Button type="button" onClick={() => void submitDelete()} disabled={saving || !selectedStayId}>
                削除
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  function renderTimeline(days: Date[]) {
    const openHour = settings.calendar_open_hour ?? 8
    const closeHour = settings.calendar_close_hour ?? 20
    const totalHours = Math.max(1, closeHour - openHour + 1)
    const totalMinutes = totalHours * 60
    const laneRowHeight = 30
    const timelineMinWidth = Math.max(960, totalHours * 70)

    function assignStayLanes(day: Date, dayStays: StayRow[]) {
      const laneEnds: number[] = []
      const visibleRows: Array<{
        stay: StayRow
        lane: number
        startOffsetMin: number
        durationMin: number
      }> = []
      const sorted = [...dayStays].sort((a, b) => a.planned_check_in_at.localeCompare(b.planned_check_in_at))

      sorted.forEach((stay) => {
        const { visibleStart, visibleEnd } = getVisibleStayWindow(stay, day, openHour, closeHour)
        const startOffsetMin = Math.max(0, getMinutesFromDayStart(visibleStart) - openHour * 60)
        const endOffsetMin = Math.max(startOffsetMin + 30, getMinutesFromDayStart(visibleEnd) - openHour * 60)
        const durationMin = Math.max(30, endOffsetMin - startOffsetMin)

        let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startOffsetMin)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(startOffsetMin + durationMin)
        } else {
          laneEnds[lane] = startOffsetMin + durationMin
        }

        visibleRows.push({ stay, lane, startOffsetMin, durationMin })
      })

      return {
        totalLanes: Math.max(1, laneEnds.length),
        rows: visibleRows,
      }
    }

    return (
      <div className="overflow-x-auto">
        <div className="rounded border border-gray-200" style={{ minWidth: `${timelineMinWidth}px` }}>
          <div className="grid grid-cols-[160px_minmax(0,1fr)] border-b bg-gray-50 text-xs font-semibold text-gray-600">
            <div className="border-r px-3 py-2">日付</div>
            <div className="relative h-9">
              {dayHours.map((hour) => (
                <div
                  key={`hotel-hour-${hour}`}
                  className="absolute top-0 text-[11px] text-gray-500"
                  style={{
                    left: `${((hour - openHour) / totalHours) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const key = toJstDateKey(day)
            const dayStays = (staysByDay.get(key) ?? []).filter((stay) => {
              const dayParts = getJstParts(day)
              const dayStartIso = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, openHour).toISOString()
              const dayEndIso = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, closeHour + 1).toISOString()
              return intersects(dayStartIso, dayEndIso, stay.planned_check_in_at, stay.planned_check_out_at)
            })
            const laneData = assignStayLanes(day, dayStays)
            const rowHeight = Math.max(36, laneData.totalLanes * laneRowHeight)
            const peak = dayHours.reduce((max, hour) => {
              const dayParts = getJstParts(day)
              const slotStart = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, hour).toISOString()
              const slotEnd = createDateFromJst(dayParts.year, dayParts.month, dayParts.day, hour + 1).toISOString()
              const count = dayStays.filter((stay) =>
                intersects(slotStart, slotEnd, stay.planned_check_in_at, stay.planned_check_out_at)
              ).length
              return Math.max(max, count)
            }, 0)
            const isOverCapacity = peak > settings.max_concurrent_pets

            return (
              <div key={key} className="grid grid-cols-[160px_minmax(0,1fr)] border-b last:border-b-0">
                <div className="border-r bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{formatDate(day)}</p>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        isOverCapacity ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      最大 {peak}/{settings.max_concurrent_pets}
                    </span>
                  </div>
                </div>
                <div className={`relative ${isOverCapacity ? 'bg-red-50/60' : 'bg-white'}`} style={{ height: `${rowHeight}px` }}>
                  {Array.from({ length: totalHours + 1 }, (_, index) => (
                    <div
                      key={`line-${key}-${index}`}
                      className="absolute bottom-0 top-0 border-l border-gray-200"
                      style={{ left: `${(index / totalHours) * 100}%` }}
                    />
                  ))}
                  {laneData.rows.map(({ stay, lane, startOffsetMin, durationMin }) => {
                    const leftPercent = (startOffsetMin / totalMinutes) * 100
                    const widthPercent = (durationMin / totalMinutes) * 100
                    const petLabel = pets.find((pet) => pet.id === stay.pet_id)?.label ?? stay.pet_id
                    const top = lane * laneRowHeight + 2
                    return (
                      <button
                        key={stay.id}
                        type="button"
                        onClick={() => openEdit(stay.id)}
                        className="absolute rounded border border-sky-300 bg-sky-100 px-2 py-1 text-left text-xs text-sky-900"
                        style={{
                          top,
                          left: `${leftPercent}%`,
                          width: `${Math.max(widthPercent, 4)}%`,
                          minWidth: '72px',
                          height: `${laneRowHeight - 4}px`,
                        }}
                      >
                        <p className="truncate font-semibold">{petLabel}</p>
                        <p className="truncate">
                          {formatTime(stay.planned_check_in_at)} - {formatTime(stay.planned_check_out_at)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderMonthSummary() {
    return (
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day) => {
          const key = toJstDateKey(day)
          const dayStays = staysByDay.get(key) ?? []
          const peak = dayHours.reduce((max, hour) => {
            const parts = getJstParts(day)
            const slotStart = createDateFromJst(parts.year, parts.month, parts.day, hour).toISOString()
            const slotEnd = createDateFromJst(parts.year, parts.month, parts.day, hour + 1).toISOString()
            const count = dayStays.filter((stay) =>
              intersects(slotStart, slotEnd, stay.planned_check_in_at, stay.planned_check_out_at)
            ).length
            return Math.max(max, count)
          }, 0)
          const checkIns = dayStays.filter((stay) => toJstDateKey(stay.planned_check_in_at) === key).length
          const checkOuts = dayStays.filter((stay) => toJstDateKey(stay.planned_check_out_at) === key).length

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setViewMode('day')
                setAnchorDate(day)
                setActiveTab('calendar')
              }}
              className={`rounded border p-3 text-left ${
                peak > settings.max_concurrent_pets ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{formatDate(day)}</p>
              <p className="mt-2 text-xs text-gray-600">最大同時 {peak}/{settings.max_concurrent_pets}</p>
              <p className="text-xs text-gray-600">チェックイン {checkIns}</p>
              <p className="text-xs text-gray-600">チェックアウト {checkOuts}</p>
            </button>
          )
        })}
      </div>
    )
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'list', label: '一覧' },
    { id: 'calendar', label: 'カレンダー' },
    { id: 'settings', label: '運用設定' },
    { id: 'menus', label: '商品台帳' },
  ]

  return (
    <div className="space-y-4">
      {message ? (
        <Card>
          <p className="text-sm text-gray-700">{message}</p>
        </Card>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>
      </Card>

      {activeTab === 'settings' ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ホテル運用設定</h2>
              <p className="mt-1 text-xs text-gray-500">予約可能頭数の上限を設定します。</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
              <label className="text-sm text-gray-700">
                同時預かり上限
                <input
                  type="number"
                  min={1}
                  value={settings.max_concurrent_pets}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, max_concurrent_pets: Number(event.target.value) || 1 }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
            </div>
          </div>
          <div className="mt-3">
            <Button type="button" onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? '保存中...' : '設定を保存'}
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === 'list' ? (
        <>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">ホテル台帳一覧</h2>
                <p className="mt-1 text-xs text-gray-500">一覧確認と既存予約の編集導線をここに集約しています。</p>
              </div>
              <Button type="button" onClick={openCreate}>
                新規予約を登録
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-left text-sm text-slate-900">
                <thead className="border-b bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-2">コード</th>
                    <th className="px-2.5 py-2">ペット</th>
                    <th className="px-2.5 py-2">利用時間</th>
                    <th className="px-2.5 py-2">ステータス</th>
                    <th className="px-2.5 py-2">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stays.map((stay) => (
                    <tr
                      key={stay.id}
                      onClick={() => setSelectedStayId(stay.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedStayId === stay.id ? 'bg-sky-100 hover:bg-sky-100' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <td className="px-2.5 py-2 font-medium text-slate-950">{stay.stay_code}</td>
                      <td className="px-2.5 py-2 text-slate-900">
                        {pets.find((pet) => pet.id === stay.pet_id)?.label ?? stay.pet_id}
                      </td>
                      <td className="px-2.5 py-2 text-slate-800">
                        <p>{formatDateTime(stay.planned_check_in_at)}</p>
                        <p>{formatDateTime(stay.planned_check_out_at)}</p>
                      </td>
                      <td className="px-2.5 py-2 text-slate-900">{statusLabel(stay.status)}</td>
                      <td className="px-2.5 py-2 font-semibold text-slate-950">{formatMoney(stay.total_amount_jpy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedStay ? (
            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedStay.stay_code}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {pets.find((pet) => pet.id === selectedStay.pet_id)?.label ?? selectedStay.pet_id} /{' '}
                    {statusLabel(selectedStay.status)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => void createUnifiedInvoiceFromSelectedStay()} disabled={creatingInvoice}>
                    {creatingInvoice ? '統合会計を作成中...' : '統合会計を作成'}
                  </Button>
                  <Button type="button" onClick={() => openEdit(selectedStay.id)}>
                    この予約を編集
                  </Button>
                </div>
              </div>
              {invoiceMessage ? (
                <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p>{invoiceMessage}</p>
                  <Link href="/payments" className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline">
                    会計管理を開く
                  </Link>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border border-gray-200 p-4 text-sm text-gray-700">
                  <p>予定チェックイン: {formatDateTime(selectedStay.planned_check_in_at)}</p>
                  <p>予定チェックアウト: {formatDateTime(selectedStay.planned_check_out_at)}</p>
                  <p>実績チェックイン: {formatDateTime(selectedStay.actual_check_in_at)}</p>
                  <p>実績チェックアウト: {formatDateTime(selectedStay.actual_check_out_at)}</p>
                  <p>備考: {selectedStay.notes ?? 'なし'}</p>
                </div>
                <div className="rounded border border-gray-200 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">明細</p>
                  <div className="mt-2 space-y-1">
                    {(selectedStay.selected_items ?? []).map((item) => (
                      <p key={item.id}>
                        {item.label_snapshot} x {item.quantity} = {formatMoney(item.line_amount_jpy)}
                      </p>
                    ))}
                    {(selectedStay.selected_items ?? []).length === 0 ? <p>明細なし</p> : null}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {activeTab === 'calendar' ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">稼働カレンダー</h2>
              <p className="mt-1 text-xs text-gray-500">週/日ビューを主表示にして、時間預かりの重複を確認できます。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={openCreate}>
                新規予約
              </Button>
              {selectedStay ? (
                <Button type="button" onClick={() => openEdit(selectedStay.id)}>
                  選択中を編集
                </Button>
              ) : null}
              <Button type="button" onClick={() => shiftCalendar(-1)}>
                前へ
              </Button>
              <Button type="button" onClick={() => setAnchorDate(new Date())}>
                今日
              </Button>
              <Button type="button" onClick={() => shiftCalendar(1)}>
                次へ
              </Button>
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as ViewMode)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="week">週</option>
                <option value="day">日</option>
                <option value="month">月</option>
              </select>
            </div>
          </div>
          <div className="mt-4">{viewMode === 'month' ? renderMonthSummary() : renderTimeline(calendarDays)}</div>
        </Card>
      ) : null}

      {activeTab === 'menus' ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ホテル商品台帳</h2>
              <p className="mt-1 text-xs text-gray-500">
                表示順の推奨は通常期 `10-199`、ハイシーズン `300-499` です。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void switchSeasonMode('normal')}
                disabled={seasonSwitchingMode !== null}
              >
                {seasonSwitchingMode === 'normal' ? '切替中...' : '通常メニューON'}
              </Button>
              <Button
                type="button"
                onClick={() => void switchSeasonMode('high_season')}
                disabled={seasonSwitchingMode !== null}
              >
                {seasonSwitchingMode === 'high_season' ? '切替中...' : 'ハイシーズンON'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setMenuItemDraft(buildMenuItemDraft())
                  setShowMenuItemForm((prev) => !prev)
                }}
              >
                {showMenuItemForm ? '入力を閉じる' : '商品を追加'}
              </Button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">通常メニュー</p>
              <p className="mt-1">対象件数: {normalMenuCount} 件</p>
              <p className="text-xs text-gray-500">表示順 10-199 を一括で ON/OFF します。</p>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">ハイシーズンメニュー</p>
              <p className="mt-1">対象件数: {highSeasonMenuCount} 件</p>
              <p className="text-xs text-gray-500">表示順 300-499 を一括で ON/OFF します。</p>
            </div>
          </div>

          {showMenuItemForm ? (
            <div className="mb-4 grid grid-cols-1 gap-3 rounded border border-gray-200 p-4 md:grid-cols-3">
              <label className="text-sm text-gray-700">
                商品名
                <input
                  type="text"
                  value={menuItemDraft.name}
                  onChange={(event) => setMenuItemDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                種別
                <select
                  value={menuItemDraft.item_type}
                  onChange={(event) => setMenuItemDraft((prev) => ({ ...prev, item_type: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="overnight">宿泊</option>
                  <option value="time_pack">時間預かり</option>
                  <option value="option">オプション</option>
                  <option value="transport">送迎</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                課金単位
                <select
                  value={menuItemDraft.billing_unit}
                  onChange={(event) => setMenuItemDraft((prev) => ({ ...prev, billing_unit: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="per_stay">回数</option>
                  <option value="per_night">泊数</option>
                  <option value="per_hour">時間</option>
                  <option value="fixed">固定</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                価格
                <input
                  type="number"
                  min={0}
                  value={menuItemDraft.price}
                  onChange={(event) => setMenuItemDraft((prev) => ({ ...prev, price: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                標準数量
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={menuItemDraft.default_quantity}
                  onChange={(event) =>
                    setMenuItemDraft((prev) => ({ ...prev, default_quantity: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                所要時間(分)
                <input
                  type="number"
                  min={0}
                  value={menuItemDraft.duration_minutes}
                  onChange={(event) =>
                    setMenuItemDraft((prev) => ({ ...prev, duration_minutes: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={menuItemDraft.counts_toward_capacity}
                  onChange={(event) =>
                    setMenuItemDraft((prev) => ({ ...prev, counts_toward_capacity: event.target.checked }))
                  }
                />
                定員判定に含める
              </label>
              <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={menuItemDraft.tax_included}
                  onChange={(event) =>
                    setMenuItemDraft((prev) => ({ ...prev, tax_included: event.target.checked }))
                  }
                />
                税込価格
              </label>
              <label className="inline-flex items-center gap-2 rounded border p-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={menuItemDraft.is_active}
                  onChange={(event) =>
                    setMenuItemDraft((prev) => ({ ...prev, is_active: event.target.checked }))
                  }
                />
                有効
              </label>
              <label className="text-sm text-gray-700 md:col-span-3">
                備考
                <textarea
                  rows={2}
                  value={menuItemDraft.notes}
                  onChange={(event) => setMenuItemDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <div className="md:col-span-3">
                <Button type="button" onClick={() => void saveMenuItem()} disabled={savingMenuItem}>
                  {savingMenuItem ? '保存中...' : menuItemDraft.id ? '商品を更新' : '商品を作成'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="border-b bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2.5 py-2">商品名</th>
                  <th className="px-2.5 py-2">種別</th>
                  <th className="px-2.5 py-2">単価</th>
                  <th className="px-2.5 py-2">数量</th>
                  <th className="px-2.5 py-2">定員</th>
                  <th className="px-2.5 py-2">状態</th>
                  <th className="px-2.5 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {menuItems.map((item) => (
                  <tr key={item.id} className="text-gray-700">
                    <td className="px-2.5 py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="px-2.5 py-2">{item.item_type}</td>
                    <td className="px-2.5 py-2">{formatMoney(item.price)}</td>
                    <td className="px-2.5 py-2">{item.default_quantity}</td>
                    <td className="px-2.5 py-2">{item.counts_toward_capacity ? '対象' : '対象外'}</td>
                    <td className="px-2.5 py-2">{item.is_active ? '有効' : '無効'}</td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          onClick={() => {
                            setMenuItemDraft(buildMenuItemDraft(item))
                            setShowMenuItemForm(true)
                          }}
                          className="h-7 px-2 py-0 text-xs"
                        >
                          編集
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void deleteMenuItem(item.id)}
                          disabled={deletingMenuItemId === item.id}
                          className="h-7 px-2 py-0 text-xs"
                        >
                          {deletingMenuItemId === item.id ? '削除中...' : '削除'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {reservationMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalPanelRef}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {reservationMode === 'create' ? 'ホテル予約 新規作成' : 'ホテル予約 編集'}
                </h3>
                <p className="mt-1 text-xs text-gray-500">保存後は一覧タブに戻ります。</p>
              </div>
              <button
                type="button"
                onClick={closeReservationModal}
                className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
            {renderReservationForm()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
