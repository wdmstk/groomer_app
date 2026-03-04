import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ACTIVE_STORE_COOKIE } from '@/lib/supabase/store'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  await supabase.auth.signOut()

  const response = NextResponse.redirect(new URL('/login', req.url))
  response.cookies.delete(ACTIVE_STORE_COOKIE)
  return response
}
