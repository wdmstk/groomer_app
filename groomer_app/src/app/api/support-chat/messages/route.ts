import { NextResponse } from 'next/server'
import { requireStoreSupportChatAccess } from '@/lib/auth/store-support-chat'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

function normalizeMessage(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false as const, message: 'メッセージは必須です。' }
  if (text.length > 2000) {
    return { ok: false as const, message: 'メッセージは2000文字以内で入力してください。' }
  }
  return { ok: true as const, text }
}

export async function GET() {
  const auth = await requireStoreSupportChatAccess()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('support_chat_messages')
    .select('id, sender_user_id, sender_role, message, created_at')
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const { data: staffs, error: staffsError } = await admin
    .from('staffs')
    .select('user_id, full_name')
    .eq('store_id', auth.storeId)
    .not('user_id', 'is', null)

  if (staffsError) {
    return NextResponse.json({ message: staffsError.message }, { status: 500 })
  }

  const nameByUserId = new Map((staffs ?? []).map((staff) => [staff.user_id, staff.full_name]))
  const messages = (data ?? []).map((row) => ({
    ...row,
    sender_name:
      row.sender_role === 'developer'
        ? 'サポート'
        : nameByUserId.get(row.sender_user_id) ??
          (row.sender_role === 'owner' ? 'オーナー' : 'スタッフ'),
  }))

  return NextResponse.json({
    storeId: auth.storeId,
    currentUserId: auth.user.id,
    messages,
  })
}

export async function POST(request: Request) {
  const auth = await requireStoreSupportChatAccess()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const payload = (await request.json().catch(() => null)) as { message?: string } | null
  const normalized = normalizeMessage(payload?.message)
  if (!normalized.ok) {
    return NextResponse.json({ message: normalized.message }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const senderRole = auth.role === 'owner' ? 'owner' : 'staff'
  const { data, error } = await admin
    .from('support_chat_messages')
    .insert({
      store_id: auth.storeId,
      sender_user_id: auth.user.id,
      sender_role: senderRole,
      message: normalized.text,
    })
    .select('id, sender_user_id, sender_role, message, created_at')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
