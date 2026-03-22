'use client'

import { useMemo, useState } from 'react'

type StoreOption = {
  id: string
  name: string
  role: 'owner' | 'admin'
}

type Props = {
  stores: StoreOption[]
}

export function HqHotelMenuTemplateRequestForm({ stores }: Props) {
  const [sourceStoreId, setSourceStoreId] = useState(stores[0]?.id ?? '')
  const [overwriteScope, setOverwriteScope] = useState<'price_duration_only' | 'full'>(
    'price_duration_only'
  )
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const targetOptions = useMemo(
    () => stores.filter((store) => store.id !== sourceStoreId),
    [sourceStoreId, stores]
  )

  function toggleTarget(storeId: string) {
    setSelectedTargets((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!sourceStoreId) {
      setMessage('配信元店舗を選択してください。')
      return
    }
    if (selectedTargets.length === 0) {
      setMessage('配信先店舗を1件以上選択してください。')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/hq/hotel-menu-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceStoreId,
          targetStoreIds: selectedTargets,
          overwriteScope,
        }),
      })
      const payload = (await response.json()) as { message?: string; delivery?: { id?: string } }
      if (!response.ok) {
        setMessage(payload.message ?? '配信リクエスト作成に失敗しました。')
        return
      }
      setSelectedTargets([])
      setMessage(
        `${payload.message ?? '作成しました。'} delivery_id: ${payload.delivery?.id ?? 'unknown'}`
      )
    } catch {
      setMessage('通信エラーが発生しました。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block space-y-1 text-sm text-gray-700">
        <span className="text-xs text-gray-500">配信元店舗</span>
        <select
          value={sourceStoreId}
          onChange={(event) => {
            setSourceStoreId(event.target.value)
            setSelectedTargets([])
          }}
          className="w-full rounded border border-gray-300 px-3 py-2"
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name} ({store.role})
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-sm text-gray-700">
        <span className="text-xs text-gray-500">上書き範囲</span>
        <select
          value={overwriteScope}
          onChange={(event) =>
            setOverwriteScope(event.target.value as 'price_duration_only' | 'full')
          }
          className="w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="price_duration_only">price_duration_only</option>
          <option value="full">full</option>
        </select>
      </label>

      <fieldset className="space-y-1">
        <legend className="text-xs text-gray-500">配信先店舗</legend>
        {targetOptions.length === 0 ? (
          <p className="text-sm text-gray-600">配信先に選べる店舗がありません。</p>
        ) : (
          <div className="space-y-1">
            {targetOptions.map((store) => (
              <label key={store.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedTargets.includes(store.id)}
                  onChange={() => toggleTarget(store.id)}
                />
                <span>
                  {store.name} ({store.role})
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? '作成中...' : 'ホテルメニュー配信リクエスト作成'}
      </button>

      {message ? <p className="text-sm text-gray-700">{message}</p> : null}
    </form>
  )
}
