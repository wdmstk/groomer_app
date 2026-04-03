import { NextResponse } from 'next/server'
import { asObjectOrNull } from '@/lib/object-utils'
import { requireJournalStoreContext } from '@/lib/journal/api-guard'
import { requireJournalPermission } from '@/lib/journal/permissions'
import { enqueueJournalLineNotification } from '@/lib/journal/notifications'

type RouteParams = {
  params: Promise<{
    entry_id: string
  }>
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseLinkType(value: unknown): 'photo_karte' | 'video_karte' | 'medical_record' | null {
  if (value === 'photo_karte' || value === 'video_karte' || value === 'medical_record') {
    return value
  }
  return null
}

export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const { entry_id: entryId } = await params

  const { data: entry, error: entryError } = await guard.supabase
    .from('journal_entries')
    .select('id, customer_id, status, body_text, visibility, posted_at, created_at, updated_at')
    .eq('store_id', guard.storeId)
    .eq('id', entryId)
    .maybeSingle()

  if (entryError) {
    return NextResponse.json({ message: entryError.message }, { status: 500 })
  }
  if (!entry) {
    return NextResponse.json({ message: 'Journal entry not found.' }, { status: 404 })
  }
  if (entry.visibility === 'internal') {
    const canViewInternal = requireJournalPermission(guard.permissions, 'canViewInternal')
    if (!canViewInternal.ok) {
      return NextResponse.json({ message: canViewInternal.message }, { status: canViewInternal.status })
    }
  }

  const [{ data: pets }, { data: media }, { data: healthChecks }, { data: links }, { data: notifications }] =
    await Promise.all([
      guard.supabase
        .from('journal_entry_pets')
        .select('pet_id')
        .eq('store_id', guard.storeId)
        .eq('entry_id', entryId),
      guard.supabase
        .from('journal_media')
        .select('id, media_type, storage_key, thumbnail_key, duration_sec, sort_order')
        .eq('store_id', guard.storeId)
        .eq('entry_id', entryId)
        .order('sort_order', { ascending: true }),
      guard.supabase
        .from('journal_health_checks')
        .select('id, pet_id, appetite_level, stool_level, skin_level, energy_level, memo, checked_at')
        .eq('store_id', guard.storeId)
        .eq('entry_id', entryId)
        .order('checked_at', { ascending: true }),
      guard.supabase
        .from('journal_links')
        .select('id, link_type, linked_record_id, meta_json')
        .eq('store_id', guard.storeId)
        .eq('entry_id', entryId),
      guard.supabase
        .from('journal_notifications')
        .select('id, channel, status, provider_message_id, sent_at, error_code, created_at')
        .eq('store_id', guard.storeId)
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false }),
    ])

  return NextResponse.json({
    ...entry,
    pet_ids: (pets ?? []).map((row) => String(row.pet_id)),
    media: media ?? [],
    health_checks: healthChecks ?? [],
    links: links ?? [],
    notifications: notifications ?? [],
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requireJournalStoreContext()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }
  const canCreate = requireJournalPermission(guard.permissions, 'canCreate')
  if (!canCreate.ok) {
    return NextResponse.json({ message: canCreate.message }, { status: canCreate.status })
  }

  const { entry_id: entryId } = await params
  const bodyRaw: unknown = await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const patch: {
    body_text?: string
    status?: string
    visibility?: string
    posted_at?: string
  } = {}
  const bodyText = parseOptionalString(body.body_text)
  if (bodyText !== null) patch.body_text = bodyText

  const status = parseOptionalString(body.status)
  if (status) {
    if (status === 'published') {
      const canPublish = requireJournalPermission(guard.permissions, 'canPublish')
      if (!canPublish.ok) {
        return NextResponse.json({ message: canPublish.message }, { status: canPublish.status })
      }
    }
    patch.status = status
    if (status === 'published') {
      patch.posted_at = new Date().toISOString()
    }
  }
  const visibility = parseOptionalString(body.visibility)
  if (visibility) {
    if (visibility !== 'owner' && visibility !== 'internal') {
      return NextResponse.json({ message: 'visibility must be owner or internal.' }, { status: 400 })
    }
    if (visibility === 'internal') {
      const canViewInternal = requireJournalPermission(guard.permissions, 'canViewInternal')
      if (!canViewInternal.ok) {
        return NextResponse.json({ message: canViewInternal.message }, { status: canViewInternal.status })
      }
    }
    patch.visibility = visibility
  }

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await guard.supabase
      .from('journal_entries')
      .update(patch)
      .eq('store_id', guard.storeId)
      .eq('id', entryId)

    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 })
    }
  }

  if (Array.isArray(body.media)) {
    await guard.supabase.from('journal_media').delete().eq('store_id', guard.storeId).eq('entry_id', entryId)

    const mediaRows = body.media
      .flatMap((item, index) => {
        const row = asObjectOrNull(item)
        if (!row) return []
        const storageKey = parseOptionalString(row.storage_key)
        const mediaType = parseOptionalString(row.media_type)
        if (!storageKey || !mediaType) return []
        return [{
          store_id: guard.storeId,
          entry_id: entryId,
          media_type: mediaType,
          storage_key: storageKey,
          thumbnail_key: parseOptionalString(row.thumbnail_key),
          duration_sec: Number.isFinite(Number(row.duration_sec)) ? Number(row.duration_sec) : null,
          sort_order: index,
        }]
      })

    if (mediaRows.length > 0) {
      const { error: mediaInsertError } = await guard.supabase.from('journal_media').insert(mediaRows)
      if (mediaInsertError) {
        return NextResponse.json({ message: mediaInsertError.message }, { status: 500 })
      }
    }
  }

  if (Array.isArray(body.health_checks)) {
    await guard.supabase
      .from('journal_health_checks')
      .delete()
      .eq('store_id', guard.storeId)
      .eq('entry_id', entryId)

    const healthRows = body.health_checks
      .flatMap((item) => {
        const row = asObjectOrNull(item)
        if (!row) return []
        const petId = parseOptionalString(row.pet_id)
        if (!petId) return []
        return [{
          store_id: guard.storeId,
          entry_id: entryId,
          pet_id: petId,
          appetite_level: parseOptionalString(row.appetite_level),
          stool_level: parseOptionalString(row.stool_level),
          skin_level: parseOptionalString(row.skin_level),
          energy_level: parseOptionalString(row.energy_level),
          memo: parseOptionalString(row.memo),
          checked_at: parseOptionalString(row.checked_at) ?? new Date().toISOString(),
        }]
      })

    if (healthRows.length > 0) {
      const { error: healthInsertError } = await guard.supabase.from('journal_health_checks').insert(healthRows)
      if (healthInsertError) {
        return NextResponse.json({ message: healthInsertError.message }, { status: 500 })
      }
    }
  }

  if (Array.isArray(body.links)) {
    await guard.supabase.from('journal_links').delete().eq('store_id', guard.storeId).eq('entry_id', entryId)

    const linkRows = body.links.flatMap((item) => {
      const row = asObjectOrNull(item)
      if (!row) return []
      const linkType = parseLinkType(row.link_type)
      const linkedRecordId = parseOptionalString(row.linked_record_id)
      if (!linkType || !linkedRecordId) return []
      return [{
        store_id: guard.storeId,
        entry_id: entryId,
        link_type: linkType,
        linked_record_id: linkedRecordId,
        meta_json: asObjectOrNull(row.meta_json) ?? {},
      }]
    })

    if (linkRows.length > 0) {
      const { error: linkInsertError } = await guard.supabase.from('journal_links').insert(linkRows)
      if (linkInsertError) {
        return NextResponse.json({ message: linkInsertError.message }, { status: 500 })
      }
    }
  }

  const { data: updated, error: updatedError } = await guard.supabase
    .from('journal_entries')
    .select('id, customer_id, status, body_text, posted_at, updated_at')
    .eq('store_id', guard.storeId)
    .eq('id', entryId)
    .maybeSingle()

  if (updatedError || !updated) {
    return NextResponse.json({ message: updatedError?.message ?? 'Journal entry not found.' }, { status: 404 })
  }

  let notificationStatus = 'not_requested'
  if (updated.status === 'published' && updated.customer_id) {
    const queued = await enqueueJournalLineNotification({
      supabase: guard.supabase,
      storeId: guard.storeId,
      entryId,
      customerId: String(updated.customer_id),
    })
    notificationStatus = queued.queued ? 'queued' : queued.reason
  }

  return NextResponse.json({
    entry_id: updated.id,
    status: updated.status,
    updated_at: updated.updated_at,
    posted_at: updated.posted_at,
    notification_status: notificationStatus,
  })
}
