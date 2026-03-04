'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

type MenuOption = {
  id: string
  name: string
  price: number
  duration: number
}

type ReserveFormProps = {
  storeId: string
  memberPortalToken?: string
}

type ReserveMetaResponse = {
  store: { id: string; name: string }
  menus: MenuOption[]
}

type MemberPortalPetOption = {
  id: string
  name: string
  breed: string
  qrPayload: string
}

type QrPayload = {
  v?: number
  customer_id?: string
  customer_name?: string
  phone_number?: string
  pet_id?: string
  pet_name?: string
  pet_breed?: string
  issued_at?: string
  sig?: string
}

export function ReserveForm({ storeId, memberPortalToken = '' }: ReserveFormProps) {
  const [storeName, setStoreName] = useState('')
  const [menus, setMenus] = useState<MenuOption[]>([])
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cancelUrl, setCancelUrl] = useState('')
  const [copyMessage, setCopyMessage] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [petName, setPetName] = useState('')
  const [petBreed, setPetBreed] = useState('')
  const [petGender, setPetGender] = useState('')
  const [preferredStart, setPreferredStart] = useState('')
  const [notes, setNotes] = useState('')
  const [qrCustomerName, setQrCustomerName] = useState('')
  const [qrPetName, setQrPetName] = useState('')
  const [qrPayloadText, setQrPayloadText] = useState('')
  const [qrRawInput, setQrRawInput] = useState('')
  const [qrMessage, setQrMessage] = useState('')
  const [qrError, setQrError] = useState('')
  const [qrDecoding, setQrDecoding] = useState(false)
  const [qrLookupLoading, setQrLookupLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [memberPortalPets, setMemberPortalPets] = useState<MemberPortalPetOption[]>([])
  const [selectedMemberPortalPetId, setSelectedMemberPortalPetId] = useState('')

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
              pet?: { id?: string; name?: string; breed?: string }
              pets?: MemberPortalPetOption[]
              qrPayload?: string
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
        setQrPayloadText(json?.qrPayload?.trim() ?? '')
        setMemberPortalPets(json?.pets ?? [])
        setSelectedMemberPortalPetId(json?.pet?.id ?? json?.pets?.[0]?.id ?? '')
        setQrMessage('会員証から顧客情報を引き継ぎました。')
      } catch (prefillError) {
        if (!mounted) return
        setQrError(
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
  }, [memberPortalToken])

  useEffect(() => {
    if (!selectedMemberPortalPetId || memberPortalPets.length === 0) return
    const selectedPet = memberPortalPets.find((pet) => pet.id === selectedMemberPortalPetId)
    if (!selectedPet) return
    setPetName(selectedPet.name)
    setPetBreed(selectedPet.breed)
    setQrPayloadText(selectedPet.qrPayload)
    setQrPetName(selectedPet.name)
  }, [memberPortalPets, selectedMemberPortalPetId])

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

  const applyQrPayload = async (raw: string) => {
    setQrMessage('')
    setQrError('')
    setQrLookupLoading(true)

    try {
      const parsed = JSON.parse(raw) as QrPayload
      const nextCustomerName = parsed.customer_name?.trim() ?? ''
      const nextPetName = parsed.pet_name?.trim() ?? ''
      if (!nextCustomerName || !nextPetName) {
        throw new Error('QRデータ形式が不正です。')
      }

      setCustomerName(nextCustomerName)
      setPetName(nextPetName)
      setPhoneNumber(parsed.phone_number?.trim() ?? '')
      setPetBreed(parsed.pet_breed?.trim() ?? '')
      setQrCustomerName(nextCustomerName)
      setQrPetName(nextPetName)
      setQrPayloadText(raw)

      const response = await fetch(`/api/public/reserve/${storeId}/qr-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: raw }),
      })
      const json = (await response.json().catch(() => null)) as
        | {
            message?: string
            verified?: boolean
            customer?: { full_name?: string; phone_number?: string }
            pet?: { name?: string; breed?: string }
          }
        | null

      if (!response.ok) {
        throw new Error(json?.message ?? 'QR照合に失敗しました。')
      }

      setCustomerName(json?.customer?.full_name?.trim() || nextCustomerName)
      setPetName(json?.pet?.name?.trim() || nextPetName)
      setPhoneNumber(json?.customer?.phone_number?.trim() || parsed.phone_number?.trim() || '')
      setPetBreed(json?.pet?.breed?.trim() || parsed.pet_breed?.trim() || '')
      setQrMessage('QRを検証し、既存顧客候補を照合してフォームへ反映しました。')
    } catch (scanError) {
      setQrError(scanError instanceof Error ? scanError.message : 'QR読取に失敗しました。')
      setQrPayloadText('')
    } finally {
      setQrLookupLoading(false)
    }
  }

  const handleQrImageScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setQrMessage('')
    setQrError('')
    setQrDecoding(true)
    try {
      const detectorCtor = (
        globalThis as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>>
          }
        }
      ).BarcodeDetector
      if (!detectorCtor) {
        throw new Error('このブラウザはQR画像読取に未対応です。下の「QR文字列貼り付け」を使ってください。')
      }
      const detector = new detectorCtor({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      const results = await detector.detect(bitmap)
      const raw = results[0]?.rawValue
      if (!raw) {
        throw new Error('QRコードを読み取れませんでした。')
      }
      await applyQrPayload(raw)
    } catch (scanError) {
      setQrError(scanError instanceof Error ? scanError.message : 'QR読取に失敗しました。')
    } finally {
      setQrDecoding(false)
      event.target.value = ''
    }
  }

  const handleQrTextApply = async () => {
    const raw = qrRawInput.trim()
    if (!raw) {
      setQrError('QR文字列を入力してください。')
      return
    }
    await applyQrPayload(raw)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setCopyMessage('')

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
          petName,
          petBreed,
          petGender,
          preferredStart,
          notes,
          qrPayload: qrPayloadText || null,
          menuIds: selectedMenuIds,
          memberPortalToken,
        }),
      })

      const json = (await response.json().catch(() => ({}))) as { message?: string; cancelUrl?: string }
      if (!response.ok) {
        setError(json.message ?? '予約申請に失敗しました。')
        return
      }

      setMessage(json.message ?? '予約申請を受け付けました。')
      setCancelUrl(json.cancelUrl ?? '')
      setCustomerName('')
      setPhoneNumber('')
      setEmail('')
      setPetName('')
      setPetBreed('')
      setPetGender('')
      setPreferredStart('')
      setNotes('')
      setQrCustomerName('')
      setQrPetName('')
      setQrPayloadText('')
      setQrRawInput('')
      setQrMessage('')
      setQrError('')
      setSelectedMenuIds([])
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopyCancelUrl() {
    if (!cancelUrl) return
    try {
      await navigator.clipboard.writeText(cancelUrl)
      setCopyMessage('キャンセルURLをコピーしました。')
    } catch {
      setCopyMessage('キャンセルURLのコピーに失敗しました。')
    }
    setTimeout(() => setCopyMessage(''), 2000)
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

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block rounded border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-semibold">QRコード画像から読取</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleQrImageScan}
              disabled={qrDecoding || qrLookupLoading}
              className="mt-2 block w-full rounded border bg-white p-2 text-sm text-gray-800"
            />
            {qrDecoding ? <p className="mt-1 text-xs text-gray-500">QR画像を解析中...</p> : null}
            {qrLookupLoading ? <p className="mt-1 text-xs text-gray-500">署名検証と顧客照合中...</p> : null}
            {qrMessage ? <p className="mt-1 text-xs text-emerald-700">{qrMessage}</p> : null}
            {qrError ? <p className="mt-1 text-xs text-red-600">{qrError}</p> : null}
            {qrCustomerName || qrPetName ? (
              <p className="mt-1 text-xs text-indigo-800">
                読取結果: {qrCustomerName || '未取得'} / {qrPetName || '未取得'}
              </p>
            ) : null}
            <div className="mt-2 rounded border border-indigo-200 bg-white p-2">
              <p className="text-xs text-indigo-800">BarcodeDetector 非対応時: QR文字列を貼り付け</p>
              <textarea
                className="mt-1 min-h-20 w-full rounded border p-2 text-xs text-gray-800"
                value={qrRawInput}
                onChange={(event) => setQrRawInput(event.target.value)}
                placeholder='{"v":2,"customer_id":"...","pet_id":"...","sig":"..."}'
              />
              <button
                type="button"
                onClick={() => {
                  void handleQrTextApply()
                }}
                disabled={qrLookupLoading}
                className="mt-1 rounded border border-indigo-300 bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-70"
              >
                QR文字列を適用
              </button>
            </div>
          </label>

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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {cancelUrl ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">キャンセル用URL</p>
              <p className="mt-1 break-all">{cancelUrl}</p>
              <button
                type="button"
                onClick={() => {
                  void handleCopyCancelUrl()
                }}
                className="mt-2 rounded border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-amber-900"
              >
                URLをコピー
              </button>
              {copyMessage ? <p className="mt-1">{copyMessage}</p> : null}
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
