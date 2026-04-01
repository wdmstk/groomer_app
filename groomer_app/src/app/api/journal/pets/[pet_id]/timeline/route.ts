import { NextResponse } from 'next/server'
import { requireJournalStoreContext } from '@/lib/journal/api-guard'

type RouteParams = {
  params: Promise<{
    pet_id: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { pet_id: petId } = await params

  const { data: mappings, error: mappingError } = await guard.supabase
    .from('journal_entry_pets')
    .select('entry_id')
    .eq('store_id', guard.storeId)
    .eq('pet_id', petId)

  if (mappingError) {
    return NextResponse.json({ message: mappingError.message }, { status: 500 })
  }

  const entryIds = (mappings ?? []).map((row) => String(row.entry_id)).filter(Boolean)
  if (entryIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const { data: entries, error: entriesError } = await guard.supabase
    .from('journal_entries')
    .select('id, customer_id, status, body_text, visibility, posted_at, created_at')
    .eq('store_id', guard.storeId)
    .eq('status', 'published')
    .in('id', entryIds)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (entriesError) {
    return NextResponse.json({ message: entriesError.message }, { status: 500 })
  }

  const { data: media, error: mediaError } = await guard.supabase
    .from('journal_media')
    .select('entry_id, id, media_type, storage_key, thumbnail_key, duration_sec, sort_order')
    .eq('store_id', guard.storeId)
    .in('entry_id', entryIds)
    .order('sort_order', { ascending: true })

  if (mediaError) {
    return NextResponse.json({ message: mediaError.message }, { status: 500 })
  }

  const mediaMap = new Map<string, unknown[]>()
  for (const row of media ?? []) {
    const key = String(row.entry_id)
    const list = mediaMap.get(key) ?? []
    list.push(row)
    mediaMap.set(key, list)
  }

  const items = (entries ?? []).map((entry) => ({
    ...entry,
    media: mediaMap.get(String(entry.id)) ?? [],
  }))
  const visibleItems = items.filter((entry) => {
    if (entry.visibility !== 'internal') return true
    return guard.permissions.canViewInternal
  })

  return NextResponse.json({ items: visibleItems })
}
