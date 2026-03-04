import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type StoreRow = {
  id: string
  name: string | null
  is_active: boolean
}

type LatestMessageRow = {
  store_id: string
  message: string
  created_at: string
}

export async function GET() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const admin = createAdminSupabaseClient()

  const [{ data: stores, error: storesError }, { data: latestMessages, error: latestError }] =
    await Promise.all([
      admin.from('stores').select('id, name, is_active').order('created_at', { ascending: true }),
      admin
        .from('support_chat_messages')
        .select('store_id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
    ])

  if (storesError) {
    return NextResponse.json({ message: storesError.message }, { status: 500 })
  }
  if (latestError) {
    return NextResponse.json({ message: latestError.message }, { status: 500 })
  }

  const latestByStore = new Map<string, LatestMessageRow>()
  for (const row of (latestMessages ?? []) as LatestMessageRow[]) {
    if (!latestByStore.has(row.store_id)) {
      latestByStore.set(row.store_id, row)
    }
  }

  const threads = ((stores ?? []) as StoreRow[])
    .map((store) => {
      const latest = latestByStore.get(store.id)
      return {
        store_id: store.id,
        store_name: store.name ?? '店舗名未設定',
        is_active: store.is_active,
        last_message: latest?.message ?? null,
        last_message_at: latest?.created_at ?? null,
      }
    })
    .sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return a.store_name.localeCompare(b.store_name)
      if (!a.last_message_at) return 1
      if (!b.last_message_at) return -1
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })

  return NextResponse.json({ threads })
}
