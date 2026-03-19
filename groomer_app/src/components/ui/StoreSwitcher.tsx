'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_UI_THEME, isUiTheme, type UiTheme } from '@/lib/ui/themes'
import { UI_THEME_STORAGE_KEY } from '@/lib/ui/theme-preference'

type StoreOption = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'staff'
  planCode?: string
  uiTheme?: UiTheme
  hotelOptionEnabled?: boolean
  notificationOptionEnabled?: boolean
}

type StoreResponse = {
  activeStoreId: string | null
  stores: StoreOption[]
  user?: {
    email?: string
  }
}

type StoreCachePayload = {
  savedAt: number
  data: StoreResponse
}

const STORES_CACHE_KEY = 'stores_response_cache_v1'
const ACTIVE_STORE_ID_STORAGE_KEY = 'active_store_id'
const STORES_CACHE_TTL_MS = 60 * 1000

function readStoresCache() {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(STORES_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoreCachePayload
    if (!parsed?.data || typeof parsed.savedAt !== 'number') {
      window.sessionStorage.removeItem(STORES_CACHE_KEY)
      return null
    }
    if (Date.now() - parsed.savedAt > STORES_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(STORES_CACHE_KEY)
      return null
    }
    return parsed.data
  } catch {
    window.sessionStorage.removeItem(STORES_CACHE_KEY)
    return null
  }
}

function writeStoresCache(data: StoreResponse) {
  if (typeof window === 'undefined') return
  const payload: StoreCachePayload = { savedAt: Date.now(), data }
  window.sessionStorage.setItem(STORES_CACHE_KEY, JSON.stringify(payload))
}

function persistActiveStoreId(activeStoreId: string | null) {
  if (typeof window === 'undefined') return
  if (activeStoreId) {
    window.sessionStorage.setItem(ACTIVE_STORE_ID_STORAGE_KEY, activeStoreId)
    return
  }
  window.sessionStorage.removeItem(ACTIVE_STORE_ID_STORAGE_KEY)
}

type StoreSwitcherProps = {
  onActiveStoreNameChange?: (name: string) => void
  onActiveStoreRoleChange?: (role: 'owner' | 'admin' | 'staff' | '') => void
  onActiveStorePlanCodeChange?: (planCode: string) => void
  onActiveStoreOptionStateChange?: (options: {
    hotelOptionEnabled: boolean
    notificationOptionEnabled: boolean
  }) => void
  onActiveUiThemeChange?: (theme: UiTheme) => void
  onUserEmailChange?: (email: string) => void
  compact?: boolean
  className?: string
  showUnavailableState?: boolean
}

export function StoreSwitcher({
  onActiveStoreNameChange,
  onActiveStoreRoleChange,
  onActiveStorePlanCodeChange,
  onActiveStoreOptionStateChange,
  onActiveUiThemeChange,
  onUserEmailChange,
  compact = false,
  className = '',
  showUnavailableState = false,
}: StoreSwitcherProps) {
  const router = useRouter()
  const [data, setData] = useState<StoreResponse>({ activeStoreId: null, stores: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isMounted = true

    async function loadStores() {
      const cached = readStoresCache()
      if (cached) {
        const resolvedActiveStoreId = cached.activeStoreId ?? cached.stores[0]?.id ?? null
        const nextData = { ...cached, activeStoreId: resolvedActiveStoreId }
        if (isMounted) {
          setData(nextData)
          if (onUserEmailChange) {
            onUserEmailChange(nextData.user?.email ?? '')
          }
          setIsLoading(false)
        }
        persistActiveStoreId(resolvedActiveStoreId)
        return
      }

      const response = await fetch('/api/stores', { cache: 'no-store' })
      if (!response.ok) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      const json = (await response.json()) as StoreResponse
      const resolvedActiveStoreId = json.activeStoreId ?? json.stores[0]?.id ?? null
      const nextData = { ...json, activeStoreId: resolvedActiveStoreId }
      writeStoresCache(nextData)
      persistActiveStoreId(resolvedActiveStoreId)
      if (isMounted) {
        setData(nextData)
        if (onUserEmailChange) {
          onUserEmailChange(nextData.user?.email ?? '')
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
    if (isLoading || data.stores.length === 0) return
    if (!onActiveStoreNameChange) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    if (activeStore?.name) {
      onActiveStoreNameChange(activeStore.name)
    }
  }, [data.activeStoreId, data.stores, isLoading, onActiveStoreNameChange])

  useEffect(() => {
    if (isLoading || data.stores.length === 0) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const role = activeStore?.role ?? ''
    if (onActiveStoreRoleChange) {
      onActiveStoreRoleChange(role)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('active_store_role', role)
    }
  }, [data.activeStoreId, data.stores, isLoading, onActiveStoreRoleChange])

  useEffect(() => {
    if (isLoading || data.stores.length === 0) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const planCode = activeStore?.planCode ?? 'light'
    if (onActiveStorePlanCodeChange) {
      onActiveStorePlanCodeChange(planCode)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('active_store_plan_code', planCode)
    }
  }, [data.activeStoreId, data.stores, isLoading, onActiveStorePlanCodeChange])

  useEffect(() => {
    if (isLoading || data.stores.length === 0) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const nextOptionState = {
      hotelOptionEnabled: activeStore?.hotelOptionEnabled === true,
      notificationOptionEnabled: activeStore?.notificationOptionEnabled === true,
    }
    if (onActiveStoreOptionStateChange) {
      onActiveStoreOptionStateChange(nextOptionState)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'active_store_option_state',
        JSON.stringify(nextOptionState)
      )
    }
  }, [data.activeStoreId, data.stores, isLoading, onActiveStoreOptionStateChange])

  useEffect(() => {
    if (isLoading || data.stores.length === 0) return
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const uiTheme = isUiTheme(activeStore?.uiTheme) ? activeStore.uiTheme : DEFAULT_UI_THEME
    if (onActiveUiThemeChange) {
      onActiveUiThemeChange(uiTheme)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme)
    }
  }, [data.activeStoreId, data.stores, isLoading, onActiveUiThemeChange])

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

    setData((prev) => {
      const nextData = { ...prev, activeStoreId: nextStoreId }
      writeStoresCache(nextData)
      return nextData
    })
    persistActiveStoreId(nextStoreId)
    startTransition(() => {
      router.refresh()
    })
  }

  if (isLoading || data.stores.length === 0) {
    return null
  }

  if (data.stores.length <= 1) {
    if (!showUnavailableState) {
      return null
    }
    const singleStore = data.stores[0]
    return (
      <div className={className}>
        <p className="mb-1 text-xs font-semibold text-gray-600">店舗切替</p>
        <p className="rounded border bg-gray-50 px-2 py-2 text-xs text-gray-600">
          {singleStore ? `${singleStore.name}（単一店舗のため切替なし）` : '店舗情報を取得できませんでした'}
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={className}>
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

  return (
    <div className={`mb-3 rounded border bg-gray-50 p-2 ${className}`.trim()}>
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
