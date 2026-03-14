import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/auth-helpers-nextjs'
import type { CookieOptions } from '@supabase/auth-helpers-nextjs'

async function createCookieAdapter() {
  const cookieStore = await cookies()

  return {
    getAll() {
      return cookieStore.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }))
    },
    setAll(
      cookiesToSet: {
        name: string
        value: string
        options: CookieOptions
      }[]
    ) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set({ name, value, ...options })
      })
    },
  }
}

export async function createServerSupabaseClient() {
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: await createCookieAdapter(),
    }
  )
}

export function createRouteHandlerSupabaseClient() {
  return createServerSupabaseClient()
}

export const createServerClient = createServerSupabaseClient
export const createRouteHandlerClient = createRouteHandlerSupabaseClient
