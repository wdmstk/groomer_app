'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  buildPublicSubmittedReservationSummary,
  formatPublicSlotLabel,
  formatPublicSlotTime,
  getPublicSlotMessage,
  toPublicJstDatetimeLocalValue,
} from '@/lib/public-reservations/presentation'

type MenuOption = {
  id: string
  name: string
  price: number
  duration: number
}

type ReserveFormProps = {
  storeId: string
  memberPortalToken?: string
  reservationMode?: 'repeat' | 'new'
}

type ReserveMetaResponse = {
  store: { id: string; name: string }
  menus: MenuOption[]
  instant_menu_ids?: string[]
}

type MemberPortalPetOption = {
  id: string
  name: string
  breed: string
  gender?: string
}

type SlotCandidate = {
  start_time: string
  end_time: string
  staff_id?: string | null
}

type SubmittedReservationSummary = {
  appointmentId: string
  groupId: string | null
  petName: string
  preferredStart: string
  status: string
}

function formatDateKeyJst(date: Date) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function addDaysDateKeyJst(baseDateKey: string, days: number) {
  const source = new Date(`${baseDateKey}T00:00:00+09:00`)
  if (Number.isNaN(source.getTime())) return baseDateKey
  const next = new Date(source.getTime() + days * 24 * 60 * 60 * 1000)
  return formatDateKeyJst(next)
}

export function ReserveForm({
  storeId,
  memberPortalToken = '',
  reservationMode = 'new',
}: ReserveFormProps) {
  const todayDateKeyJst = useMemo(() => formatDateKeyJst(new Date()), [])
  const [storeName, setStoreName] = useState('')
  const [menus, setMenus] = useState<MenuOption[]>([])
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slotLoading, setSlotLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [slotMessage, setSlotMessage] = useState('')
  const [instantMenuIds, setInstantMenuIds] = useState<string[]>([])
  const [slotCandidates, setSlotCandidates] = useState<SlotCandidate[]>([])
  const [selectedSlotStartIso, setSelectedSlotStartIso] = useState('')
  const [selectedSlotStaffId, setSelectedSlotStaffId] = useState('')
  const [submittedReservations, setSubmittedReservations] = useState<SubmittedReservationSummary[]>([])
  const [currentGroupId, setCurrentGroupId] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [petName, setPetName] = useState('')
  const [petBreed, setPetBreed] = useState('')
  const [petGender, setPetGender] = useState('')
  const [preferredStart, setPreferredStart] = useState('')
  const [notes, setNotes] = useState('')
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [memberPortalPets, setMemberPortalPets] = useState<MemberPortalPetOption[]>([])
  const [selectedMemberPortalPetId, setSelectedMemberPortalPetId] = useState('')
  const [recommendedMenuIds, setRecommendedMenuIds] = useState<string[]>([])
  const [slotTargetDate, setSlotTargetDate] = useState(todayDateKeyJst)
  const [slotWindowDays, setSlotWindowDays] = useState(7)

  useEffect(() => {
    let mounted = true

    async function load() {
      const response = await fetch(`/api/public/reserve/${storeId}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as Partial<ReserveMetaResponse> & {
        message?: string
      }

      if (!mounted) return

      if (!response.ok || !json.store) {
        setError(json.message ?? '予約フォームを読み込めませんでした。')
        setIsLoading(false)
        return
      }

      setStoreName(json.store.name)
      setMenus(json.menus ?? [])
      setInstantMenuIds(json.instant_menu_ids ?? [])
      setIsLoading(false)
    }

    void load()
    return () => {
      mounted = false
    }
  }, [storeId])

  useEffect(() => {
    if (!memberPortalToken) return

    let mounted = true

    async function loadPrefill() {
      setPrefillLoading(true)
      try {
        const response = await fetch(`/api/public/member-portal/${memberPortalToken}/prefill`, {
          cache: 'no-store',
        })
        const json = (await response.json().catch(() => null)) as
            | {
                message?: string
                customer?: { full_name?: string; phone_number?: string; email?: string }
                pet?: { id?: string; name?: string; breed?: string; gender?: string }
                pets?: MemberPortalPetOption[]
                recommendedMenuIds?: string[]
              }
            | null

        if (!mounted) return

        if (!response.ok) {
          throw new Error(json?.message ?? '会員証から顧客情報を読み込めませんでした。')
        }

        setCustomerName(json?.customer?.full_name?.trim() ?? '')
        setPhoneNumber(json?.customer?.phone_number?.trim() ?? '')
        setEmail(json?.customer?.email?.trim() ?? '')
        setPetName(json?.pet?.name?.trim() ?? '')
        setPetBreed(json?.pet?.breed?.trim() ?? '')
        setPetGender(json?.pet?.gender?.trim() ?? '')
        setMemberPortalPets(json?.pets ?? [])
        setSelectedMemberPortalPetId(json?.pet?.id ?? json?.pets?.[0]?.id ?? '')
        const nextRecommendedMenuIds = (json?.recommendedMenuIds ?? []).filter(Boolean)
        setRecommendedMenuIds(nextRecommendedMenuIds)
        if (reservationMode === 'repeat' && nextRecommendedMenuIds.length > 0) {
          setSelectedMenuIds(nextRecommendedMenuIds)
          setMessage('会員証から顧客情報を引き継ぎ、前回メニューを選択しました。')
        } else {
          setMessage('会員証から顧客情報を引き継ぎました。')
        }
      } catch (prefillError) {
        if (!mounted) return
        const fallbackResponse = await fetch(`/api/public/member-portal/${memberPortalToken}`, {
          cache: 'no-store',
        }).catch(() => null)
        const fallbackJson = fallbackResponse
          ? ((await fallbackResponse.json().catch(() => null)) as
              | {
                  customer?: { full_name?: string }
                  nextAppointment?: { pet_name?: string | null }
                }
              | null)
          : null
        if (fallbackResponse?.ok) {
          const fallbackPetName = fallbackJson?.nextAppointment?.pet_name ?? ''
          setCustomerName(fallbackJson?.customer?.full_name?.trim() ?? '')
          setPetName(fallbackPetName.trim())
          setMessage('会員証から顧客情報を一部引き継ぎました。')
          setError('')
          return
        }
        setError(
          prefillError instanceof Error
            ? prefillError.message
            : '会員証から顧客情報を読み込めませんでした。'
        )
      } finally {
        if (mounted) {
          setPrefillLoading(false)
        }
      }
    }

    void loadPrefill()

    return () => {
      mounted = false
    }
  }, [memberPortalToken, reservationMode])

  useEffect(() => {
    if (!selectedMemberPortalPetId || memberPortalPets.length === 0) return
    const selectedPet = memberPortalPets.find((pet) => pet.id === selectedMemberPortalPetId)
    if (!selectedPet) return
    setPetName(selectedPet.name)
    setPetBreed(selectedPet.breed)
    setPetGender(selectedPet.gender?.trim() ?? '')
  }, [memberPortalPets, selectedMemberPortalPetId])

  useEffect(() => {
    if (menus.length === 0) return
    const validMenuIdSet = new Set(menus.map((menu) => menu.id))
    setSelectedMenuIds((prev) => prev.filter((id) => validMenuIdSet.has(id)))
    setRecommendedMenuIds((prev) => prev.filter((id) => validMenuIdSet.has(id)))
  }, [menus])

  useEffect(() => {
    if (selectedMenuIds.length === 0) {
      setSlotCandidates([])
      setSlotMessage('')
      setSelectedSlotStartIso('')
      setSelectedSlotStaffId('')
      return
    }

    const nextSlotMessage = getPublicSlotMessage({ selectedMenuIds, instantMenuIds })
    if (nextSlotMessage) {
      setSlotCandidates([])
      setSlotMessage(nextSlotMessage)
      setSelectedSlotStartIso('')
      setSelectedSlotStaffId('')
      return
    }

    let mounted = true
    setSlotLoading(true)
    setSlotMessage('')
    const query = encodeURIComponent(selectedMenuIds.join(','))
    const targetDate = encodeURIComponent(slotTargetDate)

    async function loadSlots() {
      const response = await fetch(
        `/api/public/reserve/${storeId}/slots?menu_ids=${query}&target_date=${targetDate}`,
        { cache: 'no-store' }
      )
      const json = (await response.json().catch(() => ({}))) as {
        message?: string
        slots?: SlotCandidate[]
        config?: { days?: number }
      }
      if (!mounted) return
      setSlotCandidates(json.slots ?? [])
      setSlotMessage(json.message ?? '')
      setSlotWindowDays(Math.max(1, Number(json.config?.days ?? 7)))
      setSelectedSlotStartIso('')
      setSelectedSlotStaffId('')
    }

    void loadSlots().finally(() => {
      if (mounted) setSlotLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [instantMenuIds, selectedMenuIds, slotTargetDate, storeId])

  useEffect(() => {
    const maxDate = addDaysDateKeyJst(todayDateKeyJst, Math.max(0, slotWindowDays - 1))
    if (slotTargetDate < todayDateKeyJst || slotTargetDate > maxDate) {
      setSlotTargetDate(todayDateKeyJst)
    }
  }, [slotTargetDate, slotWindowDays, todayDateKeyJst])

  const maxSlotTargetDate = useMemo(
    () => addDaysDateKeyJst(todayDateKeyJst, Math.max(0, slotWindowDays - 1)),
    [slotWindowDays, todayDateKeyJst]
  )

  const hasSelectedRecommendedMenus = useMemo(() => {
    if (recommendedMenuIds.length === 0) return false
    const selectedIdSet = new Set(selectedMenuIds)
    return recommendedMenuIds.every((menuId) => selectedIdSet.has(menuId))
  }, [recommendedMenuIds, selectedMenuIds])

  const modeLabel = reservationMode === 'repeat' ? '前回メニュー予約' : '新規予約'

  const totalDuration = useMemo(() => {
    return menus
      .filter((menu) => selectedMenuIds.includes(menu.id))
      .reduce((sum, menu) => sum + menu.duration, 0)
  }, [menus, selectedMenuIds])

  const toggleMenu = (menuId: string) => {
    setSelectedMenuIds((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    )
  }

  const applyRecommendedMenus = () => {
    if (recommendedMenuIds.length === 0) return
    setSelectedMenuIds(recommendedMenuIds)
    setSelectedSlotStartIso('')
    setSelectedSlotStaffId('')
  }

  const clearSelectedMenus = () => {
    setSelectedMenuIds([])
    setSelectedSlotStartIso('')
    setSelectedSlotStaffId('')
    setSlotCandidates([])
    setSlotMessage('')
  }

  const handleSlotPick = (slot: SlotCandidate) => {
    setSelectedSlotStartIso(slot.start_time)
    setSelectedSlotStaffId(slot.staff_id ?? '')
    setPreferredStart(toPublicJstDatetimeLocalValue(slot.start_time))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (selectedMenuIds.length === 0) {
      setError('施術メニューを1つ以上選択してください。')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public/reserve/${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phoneNumber,
          email,
          groupId: currentGroupId,
          petName,
          petBreed,
          petGender,
          preferredStart,
          notes,
          menuIds: selectedMenuIds,
          memberPortalToken,
          member_portal_token: memberPortalToken,
          preferredStaffId: selectedSlotStaffId,
        }),
      })

      const json = (await response.json().catch(() => ({}))) as {
        message?: string
        appointmentId?: string
        groupId?: string
        status?: string
      }
      if (!response.ok) {
        setError(json.message ?? '予約申請に失敗しました。')
        return
      }

      setSubmittedReservations((prev) => [
        buildPublicSubmittedReservationSummary({
          appointmentId: json.appointmentId,
          groupId: json.groupId,
          currentGroupId,
          petName,
          preferredStart,
          status: json.status,
        }),
        ...prev,
      ])
      setCurrentGroupId(json.groupId ?? currentGroupId)
      setMessage(json.message ?? '予約申請を受け付けました。')
      setPetName('')
      setPetBreed('')
      setPetGender('')
      setPreferredStart('')
      setNotes('')
      setSelectedMenuIds([])
      setSelectedSlotStartIso('')
      setSelectedSlotStaffId('')
      setSlotCandidates([])
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleContinueWithAnotherPet() {
    setPetName('')
    setPetBreed('')
    setPetGender('')
    setPreferredStart('')
    setNotes('')
    setSelectedMenuIds([])
    setSelectedSlotStartIso('')
    setSelectedSlotStaffId('')
    setSlotCandidates([])
    setMessage('別のペット情報を入力して続けて予約できます。')
  }

  if (isLoading || prefillLoading) {
    return <main className="mx-auto max-w-3xl p-4 text-sm text-gray-600">読み込み中...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <section className="mx-auto max-w-3xl rounded-lg border bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-gray-900">予約申請フォーム</h1>
        <p className="mt-1 text-sm text-gray-600">
          店舗: {storeName} / 送信後は「予約申請」として登録され、店舗側確認後に確定されます。
        </p>
        <p className="mt-1 text-xs text-gray-500">予約モード: {modeLabel}</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              お名前 *
              <input
                className="mt-1 w-full rounded border p-2"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />
            </label>
            <label className="text-sm text-gray-700">
              電話番号
              <input
                className="mt-1 w-full rounded border p-2"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </label>
            <label className="text-sm text-gray-700">
              メール
              <input
                className="mt-1 w-full rounded border p-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="text-sm text-gray-700">
              希望日時 *
              <input
                className="mt-1 w-full rounded border p-2"
                type="datetime-local"
                value={preferredStart}
                onChange={(event) => setPreferredStart(event.target.value)}
                required
              />
            </label>
            <label className="text-sm text-gray-700">
              ペット名 *
              <input
                className="mt-1 w-full rounded border p-2"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                required
              />
            </label>
            {memberPortalPets.length > 1 ? (
              <label className="text-sm text-gray-700">
                ペット選択
                <select
                  className="mt-1 w-full rounded border p-2"
                  value={selectedMemberPortalPetId}
                  onChange={(event) => setSelectedMemberPortalPetId(event.target.value)}
                >
                  {memberPortalPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sm text-gray-700">
              犬種
              <input
                className="mt-1 w-full rounded border p-2"
                value={petBreed}
                onChange={(event) => setPetBreed(event.target.value)}
              />
            </label>
            <label className="text-sm text-gray-700">
              性別
              <select
                className="mt-1 w-full rounded border p-2"
                value={petGender}
                onChange={(event) => setPetGender(event.target.value)}
              >
                <option value="">未選択</option>
                <option value="オス">オス</option>
                <option value="メス">メス</option>
                <option value="不明">不明</option>
              </select>
            </label>
            <label className="text-sm text-gray-700 sm:col-span-2">
              連絡事項
              <input
                className="mt-1 w-full rounded border p-2"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>

          <div className="rounded border bg-gray-50 p-3">
            <p className="mb-2 text-sm font-semibold text-gray-900">施術メニュー *</p>
            {recommendedMenuIds.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyRecommendedMenus}
                  disabled={hasSelectedRecommendedMenus}
                  className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-60"
                >
                  前回メニューを選択
                </button>
                <button
                  type="button"
                  onClick={clearSelectedMenus}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                >
                  メニュー選択をクリア
                </button>
              </div>
            ) : null}
            <div className="space-y-2">
              {menus.map((menu) => (
                <label key={menu.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedMenuIds.includes(menu.id)}
                    onChange={() => toggleMenu(menu.id)}
                  />
                  <span className="font-medium text-gray-900">{menu.name}</span>
                  <span>
                    {menu.price.toLocaleString()} 円 / {menu.duration} 分
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">選択合計時間: {totalDuration} 分</p>
          </div>

          {selectedMenuIds.length > 0 ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 text-sm font-semibold text-emerald-900">空き枠候補（即時確定対象メニュー）</p>
              <label className="mb-2 block text-xs text-emerald-900">
                候補日
                <input
                  type="date"
                  className="mt-1 block w-full rounded border border-emerald-300 bg-white p-2 text-sm text-gray-900 sm:w-64"
                  value={slotTargetDate}
                  min={todayDateKeyJst}
                  max={maxSlotTargetDate}
                  onChange={(event) => setSlotTargetDate(event.target.value)}
                />
              </label>
              {slotLoading ? <p className="text-xs text-emerald-800">空き枠を読み込み中...</p> : null}
              {!slotLoading && slotCandidates.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {slotCandidates.map((slot) => {
                    const selected = selectedSlotStartIso === slot.start_time
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        onClick={() => handleSlotPick(slot)}
                        className={`rounded border px-3 py-2 text-left text-xs font-medium ${
                          selected
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-emerald-300 bg-white text-emerald-900'
                        }`}
                      >
                        {formatPublicSlotLabel(slot.start_time)} - {formatPublicSlotTime(slot.end_time)}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              {slotMessage ? <p className="mt-2 text-xs text-emerald-800">{slotMessage}</p> : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {submittedReservations.length > 0 ? (
            <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">家族予約の確認</p>
                  <p className="text-xs text-sky-700">このセッションで送信した予約です。</p>
                </div>
                <button
                  type="button"
                  onClick={handleContinueWithAnotherPet}
                  className="rounded border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900"
                >
                  別のペットを続けて予約
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {submittedReservations.map((reservation) => (
                  <div key={reservation.appointmentId} className="rounded border border-sky-100 bg-white p-2">
                    <p className="font-semibold">{reservation.petName}</p>
                    <p>希望日時: {reservation.preferredStart || '未設定'}</p>
                    <p>状態: {reservation.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isSubmitting ? '送信中...' : '予約申請を送信'}
          </button>
        </form>
      </section>
    </main>
  )
}
