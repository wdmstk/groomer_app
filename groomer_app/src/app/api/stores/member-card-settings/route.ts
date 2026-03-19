import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

function resolveSafeRedirectTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = resolveSafeRedirectTo(formData.get('redirect_to')?.toString() ?? null)
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError || !membership) {
    return NextResponse.json({ message: '所属情報の取得に失敗しました。' }, { status: 403 })
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ message: 'この操作は owner/admin のみ実行できます。' }, { status: 403 })
  }

  const memberCardRankVisible = formData.get('member_card_rank_visible')?.toString() === 'on'

  const { error: updateError } = await supabase
    .from('stores')
    .update({
      member_card_rank_visible: memberCardRankVisible,
    })
    .eq('id', storeId)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL(redirectTo ?? '/settings/public-reserve', request.url))
}
