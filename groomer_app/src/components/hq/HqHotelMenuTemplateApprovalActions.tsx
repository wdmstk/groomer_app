'use client'

import { useMemo, useState } from 'react'

type DeliveryRow = {
  id: string
  target_store_ids: string[]
  status: string
}

type Props = {
  deliveries: DeliveryRow[]
  manageableStoreIds: string[]
}

export function HqHotelMenuTemplateApprovalActions({ deliveries, manageableStoreIds }: Props) {
  const [selectedStoreByDelivery, setSelectedStoreByDelivery] = useState<Record<string, string>>({})
  const [commentByDelivery, setCommentByDelivery] = useState<Record<string, string>>({})
  const [loadingDeliveryId, setLoadingDeliveryId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const targetOptionsByDelivery = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const delivery of deliveries) {
      map.set(
        delivery.id,
        delivery.target_store_ids.filter((storeId) => manageableStoreIds.includes(storeId))
      )
    }
    return map
  }, [deliveries, manageableStoreIds])

  async function sendApproval(deliveryId: string, decision: 'approved' | 'rejected') {
    setMessage('')
    const storeId =
      selectedStoreByDelivery[deliveryId] ?? targetOptionsByDelivery.get(deliveryId)?.[0] ?? ''
    if (!storeId) {
      setMessage('承認対象の店舗を選択してください。')
      return
    }

    setLoadingDeliveryId(deliveryId)
    try {
      const response = await fetch(`/api/hq/hotel-menu-template-deliveries/${deliveryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          decision,
          comment: commentByDelivery[deliveryId] ?? '',
        }),
      })
      const payload = (await response.json()) as { message?: string }
      setMessage(payload.message ?? (response.ok ? '更新しました。' : '更新に失敗しました。'))
    } catch {
      setMessage('通信エラーが発生しました。')
    } finally {
      setLoadingDeliveryId(null)
    }
  }

  return (
    <div className="space-y-3">
      {deliveries
        .filter((delivery) => delivery.status === 'pending')
        .map((delivery) => {
          const targetOptions = targetOptionsByDelivery.get(delivery.id) ?? []
          if (targetOptions.length === 0) {
            return null
          }
          return (
            <div key={delivery.id} className="rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500">delivery_id: {delivery.id}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <select
                  value={selectedStoreByDelivery[delivery.id] ?? targetOptions[0]}
                  onChange={(event) =>
                    setSelectedStoreByDelivery((prev) => ({
                      ...prev,
                      [delivery.id]: event.target.value,
                    }))
                  }
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {targetOptions.map((storeId) => (
                    <option key={storeId} value={storeId}>
                      {storeId}
                    </option>
                  ))}
                </select>
                <input
                  value={commentByDelivery[delivery.id] ?? ''}
                  onChange={(event) =>
                    setCommentByDelivery((prev) => ({
                      ...prev,
                      [delivery.id]: event.target.value,
                    }))
                  }
                  placeholder="コメント（任意）"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={loadingDeliveryId === delivery.id}
                  onClick={() => sendApproval(delivery.id, 'approved')}
                  className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  承認
                </button>
                <button
                  type="button"
                  disabled={loadingDeliveryId === delivery.id}
                  onClick={() => sendApproval(delivery.id, 'rejected')}
                  className="rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  却下
                </button>
              </div>
            </div>
          )
        })}
      {message ? <p className="text-sm text-gray-700">{message}</p> : null}
    </div>
  )
}
