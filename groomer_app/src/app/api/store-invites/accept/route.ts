import { NextResponse } from 'next/server'
import { setActiveStoreIdCookie } from '@/lib/supabase/store'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { acceptStoreInvite, StoreInviteAcceptServiceError } from '@/lib/store-invites/services/accept'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''

  if (!token) {
    return NextResponse.json({ message: '招待トークンが必要です。' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const email = user.email?.toLowerCase() ?? ''
  if (!email) {
    return NextResponse.json({ message: 'ログインユーザーのメールが取得できません。' }, { status: 400 })
  }

  try {
    const result = await acceptStoreInvite({ token, user })
    await setActiveStoreIdCookie(result.storeId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StoreInviteAcceptServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
