import { NextResponse } from 'next/server'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type StoreRow = {
  id: string
  name: string | null
  is_active: boolean
}

type TicketRow = {
  store_id: string
  status: string
  subject: string
  last_activity_at: string
}

export async function GET() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status })
  }

  const admin = createAdminSupabaseClient()
  const [{ data: stores, error: storesError }, { data: tickets, error: ticketsError }] = await Promise.all([
    admin.from('stores').select('id, name, is_active').order('created_at', { ascending: true }),
    admin
      .from('support_tickets')
      .select('store_id, status, subject, last_activity_at')
      .order('last_activity_at', { ascending: false })
      .limit(2000),
  ])

  if (storesError) {
    return NextResponse.json({ message: storesError.message }, { status: 500 })
  }
  if (ticketsError) {
    return NextResponse.json({ message: ticketsError.message }, { status: 500 })
  }

  const latestByStore = new Map<string, TicketRow>()
  const openCountByStore = new Map<string, number>()
  for (const row of (tickets ?? []) as TicketRow[]) {
    if (!latestByStore.has(row.store_id)) {
      latestByStore.set(row.store_id, row)
    }
    if (['open', 'in_progress', 'waiting_user'].includes(row.status)) {
      openCountByStore.set(row.store_id, (openCountByStore.get(row.store_id) ?? 0) + 1)
    }
  }

  const threads = ((stores ?? []) as StoreRow[])
    .map((store) => {
      const latest = latestByStore.get(store.id)
      return {
        store_id: store.id,
        store_name: store.name ?? '店舗名未設定',
        is_active: store.is_active,
        open_ticket_count: openCountByStore.get(store.id) ?? 0,
        last_ticket_subject: latest?.subject ?? null,
        last_activity_at: latest?.last_activity_at ?? null,
      }
    })
    .sort((a, b) => {
      if (!a.last_activity_at && !b.last_activity_at) return a.store_name.localeCompare(b.store_name)
      if (!a.last_activity_at) return 1
      if (!b.last_activity_at) return -1
      return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
    })

  return NextResponse.json({ threads })
}
