import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveCurrentStoreId } from '@/lib/supabase/store'
import { DEFAULT_UI_THEME, isUiTheme } from '@/lib/ui/themes'
import { UI_THEME_COOKIE } from '@/lib/ui/theme-preference'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const storeId = await resolveCurrentStoreId()
  if (!storeId) {
    return NextResponse.json({ theme: DEFAULT_UI_THEME })
  }

  const { data, error } = await supabase
    .from('staffs')
    .select('ui_theme')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    theme: isUiTheme(data?.ui_theme) ? data.ui_theme : DEFAULT_UI_THEME,
  })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const storeId = await resolveCurrentStoreId()
  if (!storeId) {
    return NextResponse.json({ message: 'No active store selected.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { theme?: unknown } | null
  if (!isUiTheme(body?.theme)) {
    return NextResponse.json({ message: 'Invalid theme value.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('staffs')
    .update({ ui_theme: body.theme })
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .select('id')
    .limit(1)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ message: 'Staff profile not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ theme: body.theme })
  response.cookies.set(UI_THEME_COOKIE, body.theme, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
