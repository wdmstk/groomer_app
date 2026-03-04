'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type StoreOption = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'staff'
}

type StoreResponse = {
  activeStoreId: string | null
  stores: StoreOption[]
  user?: {
    email?: string
  }
}

type StoreSwitcherProps = {
  onActiveStoreNameChange?: (name: string) => void
  onActiveStoreRoleChange?: (role: 'owner' | 'admin' | 'staff' | '') => void
  onUserEmailChange?: (email: string) => void
}

export function StoreSwitcher({ onActiveStoreNameChange, onActiveStoreRoleChange, onUserEmailChange }: StoreSwitcherProps) {
  const router = useRouter()
  const [data, setData] = useState<StoreResponse>({ activeStoreId: null, stores: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isMounted = true

    async function loadStores() {
      const response = await fetch('/api/stores', { cache: 'no-store' })
      if (!response.ok) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      const json = (await response.json()) as StoreResponse
      if (isMounted) {
        setData(json)
        if (onUserEmailChange) {
          onUserEmailChange(json.user?.email ?? '')
        }
        setIsLoading(false)
      }
    }

    loadStores()
    return () => {
      isMounted = false
    }
  }, [onUserEmailChange])

  useEffect(() => {
    if (!onActiveStoreNameChange) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId)
    if (activeStore?.name) {
      onActiveStoreNameChange(activeStore.name)
    }
  }, [data.activeStoreId, data.stores, onActiveStoreNameChange])

  useEffect(() => {
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId)
    const role = activeStore?.role ?? ''
    if (onActiveStoreRoleChange) {
      onActiveStoreRoleChange(role)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('active_store_role', role)
    }
  }, [data.activeStoreId, data.stores, onActiveStoreRoleChange])

  async function handleChange(nextStoreId: string) {
    if (!nextStoreId || nextStoreId === data.activeStoreId) return

    const response = await fetch('/api/stores/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: nextStoreId }),
    })

    if (!response.ok) {
      return
    }

    setData((prev) => ({ ...prev, activeStoreId: nextStoreId }))
    startTransition(() => {
      router.refresh()
    })
  }

  if (isLoading || data.stores.length === 0) {
    return null
  }

  if (data.stores.length <= 1) {
    return null
  }

  return (
    <div className="mb-3 rounded border bg-gray-50 p-2">
      <label className="mb-1 block text-xs font-semibold text-gray-600" htmlFor="store-switcher">
        店舗切替
      </label>
      <select
        id="store-switcher"
        className="w-full rounded border bg-white p-2 text-sm"
        value={data.activeStoreId ?? ''}
        onChange={(event) => {
          void handleChange(event.target.value)
        }}
        disabled={isPending}
      >
        {data.stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name} ({store.role})
          </option>
        ))}
      </select>
    </div>
  )
}
