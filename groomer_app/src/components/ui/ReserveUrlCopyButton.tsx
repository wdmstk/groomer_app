'use client'

import { useEffect, useState } from 'react'

type StoreResponse = {
  activeStoreId: string | null
}

export function ReserveUrlCopyButton() {
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState('')

  async function fetchActiveStoreId() {
    const response = await fetch('/api/stores', { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const json = (await response.json()) as StoreResponse
    return json.activeStoreId
  }

  useEffect(() => {
    let isMounted = true

    async function loadActiveStore() {
      const nextActiveStoreId = await fetchActiveStoreId()
      if (!isMounted) return
      setActiveStoreId(nextActiveStoreId)
    }

    void loadActiveStore()
    return () => {
      isMounted = false
    }
  }, [])

  async function handleCopy() {
    if (typeof window === 'undefined') return

    const latestActiveStoreId = await fetchActiveStoreId()
    if (!latestActiveStoreId) return
    setActiveStoreId(latestActiveStoreId)

    const url = `${window.location.origin}/reserve/${latestActiveStoreId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('コピーしました')
    } catch {
      setCopyMessage('コピーに失敗しました')
    }
    setTimeout(() => setCopyMessage(''), 1600)
  }

  if (!activeStoreId) {
    return null
  }

  return (
    <div className="mb-4 flex justify-end">
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={() => {
            void handleCopy()
          }}
          className="rounded border bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          顧客予約URLをコピー
        </button>
        <p className="mt-1 min-h-4 text-xs text-gray-600">{copyMessage}</p>
      </div>
    </div>
  )
}
