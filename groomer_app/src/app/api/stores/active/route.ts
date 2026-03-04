import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { setActiveStoreIdCookie } from '@/lib/supabase/store'

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
  return NextResponse.json({ success: true })
}
