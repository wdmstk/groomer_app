import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createStoreScopedClient } from '@/lib/supabase/store'

const INVITABLE_ROLES = new Set(['admin', 'staff'])

async function getCurrentMembershipRole() {
  const { supabase, storeId } = await createStoreScopedClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: membership } = await supabase
    .from('store_memberships')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, storeId, userId: user.id, role: membership.role as 'owner' | 'admin' | 'staff' }
}

export async function GET() {
  const allowed = await getCurrentMembershipRole()
  if ('error' in allowed) return allowed.error

  const { supabase, storeId, role } = allowed
  if (!['owner', 'admin'].includes(role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('store_invites')
    .select('id, email, role, token, expires_at, used_at, created_at')
    .eq('store_id', storeId)
    .is('used_at', null)
    .gte('expires_at', nowIso)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ invites: data ?? [] })
}

export async function POST(request: Request) {
  const allowed = await getCurrentMembershipRole()
  if ('error' in allowed) return allowed.error

  const { supabase, storeId, userId, role: inviterRole } = allowed
  if (!['owner', 'admin'].includes(inviterRole)) {
    return NextResponse.json({ message: '招待リンクの作成は owner / admin のみ可能です。' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body?.role === 'string' ? body.role : ''

  if (!email) {
    return NextResponse.json({ message: 'メールアドレスは必須です。' }, { status: 400 })
  }

  if (!INVITABLE_ROLES.has(role)) {
    return NextResponse.json({ message: '招待可能ロールは admin / staff のみです。' }, { status: 400 })
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('store_invites').insert({
    store_id: storeId,
    email,
    role,
    token,
    invited_by: userId,
    expires_at: expiresAt,
  })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  return NextResponse.json({
    message: '招待リンクを作成しました。',
    inviteUrl: `${origin}/invite/${token}`,
    expiresAt,
  })
}
