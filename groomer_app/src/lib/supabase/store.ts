import { cookies } from 'next/headers'
import { createServerSupabaseClient } from './server'

export const ACTIVE_STORE_COOKIE = 'active_store_id'

type StoreMembership = {
  store_id: string
  role: 'owner' | 'admin' | 'staff'
}

export async function getActiveStoreIdFromCookie() {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_STORE_COOKIE)?.value ?? null
}

function safeSetCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  storeId: string
) {
  try {
    cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
  } catch {
    // Ignore when cookies are read-only (e.g. Server Components render context).
  }
}

function safeDeleteCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(ACTIVE_STORE_COOKIE)
  } catch {
    // Ignore when cookies are read-only (e.g. Server Components render context).
  }
}

export async function setActiveStoreIdCookie(storeId: string) {
  const cookieStore = await cookies()
  safeSetCookie(cookieStore, storeId)
}

export async function resolveCurrentStoreId() {
  const cookieStore = await cookies()
  const storeFromCookie = cookieStore.get(ACTIVE_STORE_COOKIE)?.value
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'

  if (isPlaywrightE2E) {
    const e2eStoreId = storeFromCookie || 'store-e2e-demo'
    safeSetCookie(cookieStore, e2eStoreId)
    return e2eStoreId
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    safeDeleteCookie(cookieStore)
    return null
  }

  const { data: memberships } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const rows = (memberships ?? []) as StoreMembership[]
  if (rows.length === 0) {
    safeDeleteCookie(cookieStore)
    return null
  }

  if (storeFromCookie) {
    const matched = rows.find((row) => row.store_id === storeFromCookie)
    if (matched) {
      return storeFromCookie
    }
  }

  const prioritized =
    rows.find((row) => row.role === 'owner') ??
    rows.find((row) => row.role === 'admin') ??
    rows[0]

  safeSetCookie(cookieStore, prioritized.store_id)

  return prioritized.store_id
}

export async function requireCurrentStoreId() {
  const storeId = await resolveCurrentStoreId()
  if (!storeId) {
    throw new Error('No active store found for current user.')
  }
  return storeId
}

export async function createStoreScopedClient() {
  const supabase = await createServerSupabaseClient()
  const storeId = await requireCurrentStoreId()
  return { supabase, storeId }
}
