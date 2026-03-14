import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { setActiveStoreIdCookie } from '@/lib/supabase/store'
import { UI_THEME_COOKIE } from '@/lib/ui/theme-preference'
import { DEFAULT_UI_THEME, isUiTheme } from '@/lib/ui/themes'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const storeId = body?.storeId as string | undefined

  if (!storeId) {
    return NextResponse.json({ message: 'storeId is required.' }, { status: 400 })
  }

  const { data: membership, error } = await supabase
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ message: '指定店舗へのアクセス権がありません。' }, { status: 403 })
  }

  await setActiveStoreIdCookie(storeId)

  const { data: staffTheme } = await supabase
    .from('staffs')
    .select('ui_theme')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const response = NextResponse.json({ success: true })
  response.cookies.set(UI_THEME_COOKIE, isUiTheme(staffTheme?.ui_theme) ? staffTheme.ui_theme : DEFAULT_UI_THEME, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
