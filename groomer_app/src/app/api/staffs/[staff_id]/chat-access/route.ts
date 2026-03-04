import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'

type RouteParams = {
  params: Promise<{
    staff_id: string
  }>
}

function redirectToStaffList(request: Request) {
  return NextResponse.redirect(new URL('/staffs?tab=list', request.url))
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireOwnerStoreMembership()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const { staff_id: staffId } = await params
  const formData = await request.formData()
  const canParticipate = formData.get('can_participate')?.toString() === 'true'

  const { data: staff, error: staffError } = await auth.supabase
    .from('staffs')
    .select('id, user_id')
    .eq('id', staffId)
    .eq('store_id', auth.storeId)
    .maybeSingle()

  if (staffError) {
    return NextResponse.json({ message: staffError.message }, { status: 500 })
  }
  if (!staff?.user_id) {
    return NextResponse.json({ message: '対象スタッフの user_id が未設定です。' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  const { data: membership, error: membershipError } = await admin
    .from('store_memberships')
    .select('role')
    .eq('store_id', auth.storeId)
    .eq('user_id', staff.user_id)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    return NextResponse.json({ message: membershipError.message }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { message: '対象ユーザーはこの店舗の有効メンバーではありません。' },
      { status: 400 }
    )
  }

  if (membership.role === 'owner') {
    return NextResponse.json(
      { message: 'owner は常にチャットに参加できます。' },
      { status: 400 }
    )
  }

  const { error: upsertError } = await admin.from('store_chat_participants').upsert(
    {
      store_id: auth.storeId,
      user_id: staff.user_id,
      can_participate: canParticipate,
    },
    { onConflict: 'store_id,user_id' }
  )

  if (upsertError) {
    return NextResponse.json({ message: upsertError.message }, { status: 500 })
  }

  return redirectToStaffList(request)
}
