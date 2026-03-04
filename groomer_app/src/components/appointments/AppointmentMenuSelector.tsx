'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type ServiceMenuOption = {
  id: string
  name: string
  price: number
  duration: number
  tax_rate: number | null
  tax_included: boolean | null
  is_active: boolean | null
}

type AppointmentMenuSelectorProps = {
  menus: ServiceMenuOption[]
  selectedIds?: string[]
  defaultSelectedIds?: string[]
  startInputId?: string
  endInputId?: string
  onSelectedIdsChange?: (selectedIds: string[]) => void
}

function calculateTotals(menus: ServiceMenuOption[]) {
  return menus.reduce(
    (acc, menu) => {
      const taxRate = menu.tax_rate ?? 0.1
      const taxIncluded = menu.tax_included ?? true
      const base = taxIncluded ? menu.price / (1 + taxRate) : menu.price
      const tax = taxIncluded ? menu.price - base : menu.price * taxRate

      acc.duration += menu.duration
      acc.subtotal += base
      acc.tax += tax
      acc.total += base + tax
      return acc
    },
    { duration: 0, subtotal: 0, tax: 0, total: 0 }
  )
}

export function AppointmentMenuSelector({
  menus,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds = [],
  startInputId = 'appointment_start_time',
  endInputId = 'appointment_end_time',
  onSelectedIdsChange,
}: AppointmentMenuSelectorProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(defaultSelectedIds)
  const [autoSyncEndTime, setAutoSyncEndTime] = useState(true)
  const selectedIds = controlledSelectedIds ?? internalSelectedIds
  const isControlled = Array.isArray(controlledSelectedIds)

  const selectedMenus = useMemo(
    () => menus.filter((menu) => selectedIds.includes(menu.id)),
    [menus, selectedIds]
  )

  const totals = useMemo(() => calculateTotals(selectedMenus), [selectedMenus])
  const menuSummary = useMemo(() => selectedMenus.map((menu) => menu.name).join(' / '), [selectedMenus])

  const toggleMenu = (menuId: string) => {
    const next = selectedIds.includes(menuId)
      ? selectedIds.filter((id) => id !== menuId)
      : [...selectedIds, menuId]
    if (!isControlled) {
      setInternalSelectedIds(next)
    }
    onSelectedIdsChange?.(next)
  }

  const syncEndTimeFromDuration = useCallback(() => {
    const startInput = document.getElementById(startInputId) as HTMLInputElement | null
    const endInput = document.getElementById(endInputId) as HTMLInputElement | null
    if (!startInput || !endInput || !startInput.value) return

    const startDate = new Date(startInput.value)
    if (Number.isNaN(startDate.getTime())) return

    const durationMinutes = Math.max(totals.duration, 30)
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

    const yyyy = endDate.getFullYear()
    const mm = String(endDate.getMonth() + 1).padStart(2, '0')
    const dd = String(endDate.getDate()).padStart(2, '0')
    const hh = String(endDate.getHours()).padStart(2, '0')
    const min = String(endDate.getMinutes()).padStart(2, '0')
    endInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`
    endInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, [endInputId, startInputId, totals.duration])

  useEffect(() => {
    if (!autoSyncEndTime) return
    syncEndTimeFromDuration()
  }, [autoSyncEndTime, syncEndTimeFromDuration])

  useEffect(() => {
    const startInput = document.getElementById(startInputId) as HTMLInputElement | null
    if (!startInput) return
    const onStartChanged = () => {
      if (autoSyncEndTime) {
        syncEndTimeFromDuration()
      }
    }
    startInput.addEventListener('change', onStartChanged)
    return () => {
      startInput.removeEventListener('change', onStartChanged)
    }
  }, [startInputId, autoSyncEndTime, syncEndTimeFromDuration])

  return (
    <div className="space-y-3">
      <input type="hidden" name="menu" value={menuSummary} />
      <input type="hidden" name="duration" value={totals.duration} />
      {menus.length === 0 ? (
        <p className="text-sm text-red-600">施術メニューが未登録です。</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {menus.map((menu) => (
            <label
              key={menu.id}
              className="flex items-center gap-2 rounded border p-2 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                name="menu_ids"
                value={menu.id}
                checked={selectedIds.includes(menu.id)}
                onChange={() => toggleMenu(menu.id)}
                className="h-4 w-4"
              />
              <span className="font-medium text-gray-900">{menu.name}</span>
              <span className="text-gray-500">
                {menu.price.toLocaleString()} 円 / {menu.duration} 分
              </span>
              {!menu.is_active && <span className="text-xs text-red-500">無効</span>}
            </label>
          ))}
        </div>
      )}

      <div className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">合計</p>
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
          <span>所要時間: {totals.duration} 分</span>
          <span>小計: {Math.round(totals.subtotal).toLocaleString()} 円</span>
          <span>税額: {Math.round(totals.tax).toLocaleString()} 円</span>
          <span>合計: {Math.round(totals.total).toLocaleString()} 円</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoSyncEndTime}
              onChange={(event) => setAutoSyncEndTime(event.target.checked)}
              className="h-4 w-4"
            />
            メニュー時間で終了時刻を自動調整
          </label>
          <button
            type="button"
            onClick={syncEndTimeFromDuration}
            className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            今すぐ終了時刻に反映
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">※実際の計算は保存時に自動反映されます。</p>
      </div>
    </div>
  )
}
