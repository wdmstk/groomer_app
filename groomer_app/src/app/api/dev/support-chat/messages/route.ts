import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { asObjectOrNull } from '@/lib/object-utils'

function normalizeStoreId(value: string | null) {
  const storeId = value?.trim()
  if (!storeId) return null
  return storeId
}

function normalizeMessage(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false as const, message: 'メッセージは必須です。' }
  if (text.length > 2000) {
    return { ok: false as const, message: 'メッセージは2000文字以内で入力してください。' }
  }
  return { ok: true as const, text }
}

async function ensureStoreExists(storeId: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.from('stores').select('id').eq('id', storeId).maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  if (!data) return { ok: false as const, status: 404, message: '対象店舗が見つかりません。' }
  return { ok: true as const }
}

export async function GET(request: Request) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const storeId = normalizeStoreId(searchParams.get('store_id'))
  if (!storeId) {
    return NextResponse.json({ message: 'store_id は必須です。' }, { status: 400 })
  }

  const storeCheck = await ensureStoreExists(storeId)
  if (!storeCheck.ok) {
    return NextResponse.json({ message: storeCheck.message }, { status: storeCheck.status })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('support_chat_messages')
    .select('id, sender_user_id, sender_role, message, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const { data: staffs, error: staffsError } = await admin
    .from('staffs')
    .select('user_id, full_name')
    .eq('store_id', storeId)
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
    storeId,
    currentUserId: auth.user.id,
    messages,
  })
}

export async function POST(request: Request) {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const payloadRaw: unknown = await request.json().catch(() => null)
  const payload = asObjectOrNull(payloadRaw)
  const storeId = normalizeStoreId(typeof payload?.store_id === 'string' ? payload.store_id : null)
  if (!storeId) {
    return NextResponse.json({ message: 'store_id は必須です。' }, { status: 400 })
  }

  const message = normalizeMessage(payload?.message)
  if (!message.ok) {
    return NextResponse.json({ message: message.message }, { status: 400 })
  }

  const storeCheck = await ensureStoreExists(storeId)
  if (!storeCheck.ok) {
    return NextResponse.json({ message: storeCheck.message }, { status: storeCheck.status })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('support_chat_messages')
    .insert({
      store_id: storeId,
      sender_user_id: auth.user.id,
      sender_role: 'developer',
      message: message.text,
    })
    .select('id, sender_user_id, sender_role, message, created_at')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
