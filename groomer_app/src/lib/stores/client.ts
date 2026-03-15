'use client'

import type { UiTheme } from '@/lib/ui/themes'

export type StoreOption = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'staff'
  planCode?: string
  uiTheme?: UiTheme
  hotelOptionEnabled?: boolean
  notificationOptionEnabled?: boolean
}

export type StoreResponse = {
  activeStoreId: string | null
  stores: StoreOption[]
  user?: {
    email?: string
  }
}

let cachedStoreResponse: StoreResponse | null = null
let inflightStoreResponsePromise: Promise<StoreResponse | null> | null = null

export async function fetchStoreResponse() {
  if (cachedStoreResponse) {
    return cachedStoreResponse
  }
  if (inflightStoreResponsePromise) {
    return inflightStoreResponsePromise
  }

  inflightStoreResponsePromise = fetch('/api/stores', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null
      const json = (await response.json()) as StoreResponse
      cachedStoreResponse = json
      return json
    })
    .finally(() => {
      inflightStoreResponsePromise = null
    })

  return inflightStoreResponsePromise
}

export function clearStoreResponseCache() {
  cachedStoreResponse = null
  inflightStoreResponsePromise = null
}
