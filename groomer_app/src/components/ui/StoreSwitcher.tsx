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
      const response = await fetch('/api/stores', { cache: 'no-store' })
      if (!response.ok) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      const json = (await response.json()) as StoreResponse
      if (isMounted) {
        const resolvedActiveStoreId = json.activeStoreId ?? json.stores[0]?.id ?? null
        setData({ ...json, activeStoreId: resolvedActiveStoreId })
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
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    if (activeStore?.name) {
      onActiveStoreNameChange(activeStore.name)
    }
  }, [data.activeStoreId, data.stores, onActiveStoreNameChange])

  useEffect(() => {
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const role = activeStore?.role ?? ''
    if (onActiveStoreRoleChange) {
      onActiveStoreRoleChange(role)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('active_store_role', role)
    }
  }, [data.activeStoreId, data.stores, onActiveStoreRoleChange])

  useEffect(() => {
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const planCode = activeStore?.planCode ?? 'light'
    if (onActiveStorePlanCodeChange) {
      onActiveStorePlanCodeChange(planCode)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('active_store_plan_code', planCode)
    }
  }, [data.activeStoreId, data.stores, onActiveStorePlanCodeChange])

  useEffect(() => {
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
  }, [data.activeStoreId, data.stores, onActiveStoreOptionStateChange])

  useEffect(() => {
    const activeStore = data.stores.find((store) => store.id === data.activeStoreId) ?? data.stores[0]
    const uiTheme = isUiTheme(activeStore?.uiTheme) ? activeStore.uiTheme : DEFAULT_UI_THEME
    if (onActiveUiThemeChange) {
      onActiveUiThemeChange(uiTheme)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme)
    }
  }, [data.activeStoreId, data.stores, onActiveUiThemeChange])

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
