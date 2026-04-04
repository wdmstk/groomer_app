import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { requireJournalStoreContext } from '@/lib/journal/api-guard'
import { requireJournalPermission } from '@/lib/journal/permissions'
import { enqueueJournalLineNotification } from '@/lib/journal/notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function parseLinkType(value: unknown): 'photo_karte' | 'video_karte' | 'medical_record' | null {
  if (value === 'photo_karte' || value === 'video_karte' || value === 'medical_record') {
    return value
  }
  return null
}

export async function GET(request: Request) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const customerId = parseOptionalString(searchParams.get('customer_id'))
  const petId = parseOptionalString(searchParams.get('pet_id'))
  const status = parseOptionalString(searchParams.get('status'))
  const from = parseOptionalString(searchParams.get('from'))
  const to = parseOptionalString(searchParams.get('to'))
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 30

  let query = guard.supabase
    .from('journal_entries')
    .select('id, customer_id, status, body_text, visibility, posted_at, created_at, updated_at')
    .eq('store_id', guard.storeId)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (customerId) query = query.eq('customer_id', customerId)
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  if (petId) {
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
      return NextResponse.json({ items: [], next_cursor: null })
    }
    query = query.in('id', entryIds)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  const items = (data ?? []).filter((row) => {
    if (row.visibility !== 'internal') return true
    return guard.permissions.canViewInternal
  })

  return NextResponse.json({
    items,
    next_cursor: null,
  })
}

export async function POST(request: Request) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  const canCreate = requireJournalPermission(guard.permissions, 'canCreate')
  if (!canCreate.ok) {
    return NextResponse.json({ message: canCreate.message }, { status: canCreate.status })
  }

  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const customerId = parseOptionalString(body.customer_id)
  const petIds = parseStringArray(body.pet_ids)
  const bodyText = parseOptionalString(body.body_text) ?? ''
  const publish = body.publish === true

  if (!customerId) {
    return NextResponse.json({ message: 'customer_id is required.' }, { status: 400 })
  }
  if (petIds.length === 0) {
    return NextResponse.json({ message: 'pet_ids is required.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const status = publish ? 'published' : 'draft'
  if (publish) {
    const canPublish = requireJournalPermission(guard.permissions, 'canPublish')
    if (!canPublish.ok) {
      return NextResponse.json({ message: canPublish.message }, { status: canPublish.status })
    }
  }

  const { data: created, error: createError } = await guard.supabase
    .from('journal_entries')
    .insert({
      store_id: guard.storeId,
      author_staff_id: guard.staffId,
      customer_id: customerId,
      status,
      body_text: bodyText,
      visibility: 'owner',
      posted_at: publish ? nowIso : null,
    })
    .select('id, status, posted_at, created_at, updated_at')
    .single()

  if (createError || !created) {
    return NextResponse.json({ message: createError?.message ?? 'Failed to create journal entry.' }, { status: 500 })
  }

  const petRows = petIds.map((petId) => ({
    store_id: guard.storeId,
    entry_id: created.id,
    pet_id: petId,
  }))
  const { error: petInsertError } = await guard.supabase.from('journal_entry_pets').insert(petRows)
  if (petInsertError) {
    return NextResponse.json({ message: petInsertError.message }, { status: 500 })
  }

  const mediaRows = Array.isArray(body.media)
    ? body.media
        .flatMap((item, index) => {
          const row = asObjectOrNull(item)
          if (!row) return []
          const storageKey = parseOptionalString(row.storage_key)
          const mediaType = parseOptionalString(row.media_type)
          if (!storageKey || !mediaType) return []
          return [{
            store_id: guard.storeId,
            entry_id: created.id,
            media_type: mediaType,
            storage_key: storageKey,
            thumbnail_key: parseOptionalString(row.thumbnail_key),
            duration_sec: Number.isFinite(Number(row.duration_sec)) ? Number(row.duration_sec) : null,
            sort_order: index,
          }]
        })
    : []

  if (mediaRows.length > 0) {
    const { error: mediaInsertError } = await guard.supabase.from('journal_media').insert(mediaRows)
    if (mediaInsertError) {
      return NextResponse.json({ message: mediaInsertError.message }, { status: 500 })
    }
  }

  const healthRows = Array.isArray(body.health_checks)
    ? body.health_checks
        .flatMap((item) => {
          const row = asObjectOrNull(item)
          if (!row) return []
          const petId = parseOptionalString(row.pet_id)
          if (!petId) return []
          return [{
            store_id: guard.storeId,
            entry_id: created.id,
            pet_id: petId,
            appetite_level: parseOptionalString(row.appetite_level),
            stool_level: parseOptionalString(row.stool_level),
            skin_level: parseOptionalString(row.skin_level),
            energy_level: parseOptionalString(row.energy_level),
            memo: parseOptionalString(row.memo),
            checked_at: parseOptionalString(row.checked_at) ?? nowIso,
          }]
        })
    : []

  if (healthRows.length > 0) {
    const { error: healthInsertError } = await guard.supabase.from('journal_health_checks').insert(healthRows)
    if (healthInsertError) {
      return NextResponse.json({ message: healthInsertError.message }, { status: 500 })
    }
  }

  const linkRows = Array.isArray(body.links)
    ? body.links
        .flatMap((item) => {
          const row = asObjectOrNull(item)
          if (!row) return []
          const linkType = parseLinkType(row.link_type)
          const linkedRecordId = parseOptionalString(row.linked_record_id)
          if (!linkType || !linkedRecordId) return []
          return [{
            store_id: guard.storeId,
            entry_id: created.id,
            link_type: linkType,
            linked_record_id: linkedRecordId,
            meta_json: asObjectOrNull(row.meta_json) ?? {},
          }]
        })
    : []

  if (linkRows.length > 0) {
    const { error: linkInsertError } = await guard.supabase.from('journal_links').insert(linkRows)
    if (linkInsertError) {
      return NextResponse.json({ message: linkInsertError.message }, { status: 500 })
    }
  }

  let notificationStatus = 'not_requested'
  if (publish) {
    const queued = await enqueueJournalLineNotification({
      supabase: guard.supabase as never,
      storeId: guard.storeId,
      entryId: created.id,
      customerId,
    })
    notificationStatus = queued.queued ? 'queued' : queued.reason
  }

  return NextResponse.json({
    entry_id: created.id,
    status: created.status,
    posted_at: created.posted_at,
    notification_status: notificationStatus,
  })
}
