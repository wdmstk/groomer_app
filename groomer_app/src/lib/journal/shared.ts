import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  hashMemberPortalToken,
  isValidMemberPortalTokenFormat,
  MemberPortalServiceError,
} from '@/lib/member-portal'
import { createSignedPhotoUrlMap } from '@/lib/medical-records/photos'
import { createSignedVideoUrlMap } from '@/lib/medical-records/videos'

type JournalEntryRow = {
  id: string
  body_text: string
  status: string
  visibility: string
  posted_at: string | null
  created_at: string
}

type EntryPetRow = {
  entry_id: string
  pet_id: string
}

type JournalMediaRow = {
  entry_id: string
  id: string
  media_type: 'photo' | 'video'
  storage_key: string
  thumbnail_key: string | null
  duration_sec: number | null
  sort_order: number
}

type PetRow = {
  id: string
  name: string | null
}

export async function getSharedJournalPayload(token: string) {
  if (!token || !isValidMemberPortalTokenFormat(token)) {
    throw new MemberPortalServiceError('日誌URLが不正です。', 400)
  }

  const admin = createAdminSupabaseClient()
  const tokenHash = hashMemberPortalToken(token)
  const nowIso = new Date().toISOString()

  const { data: portalLink, error: portalLinkError } = await admin
    .from('member_portal_links')
    .select('id, store_id, customer_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .eq('purpose', 'member_portal')
    .maybeSingle()

  if (portalLinkError) {
    throw new MemberPortalServiceError(portalLinkError.message, 500)
  }
  if (!portalLink) {
    throw new MemberPortalServiceError('日誌URLが見つかりません。', 404)
  }
  if (portalLink.revoked_at) {
    throw new MemberPortalServiceError('この日誌URLは無効化されています。', 410)
  }
  if (portalLink.expires_at <= nowIso) {
    throw new MemberPortalServiceError('この日誌URLは有効期限切れです。', 410)
  }

  const [{ data: customer }, { data: entriesData }] = await Promise.all([
    admin
      .from('customers')
      .select('id, full_name')
      .eq('store_id', portalLink.store_id)
      .eq('id', portalLink.customer_id)
      .maybeSingle(),
    admin
      .from('journal_entries')
      .select('id, body_text, status, visibility, posted_at, created_at')
      .eq('store_id', portalLink.store_id)
      .eq('customer_id', portalLink.customer_id)
      .eq('status', 'published')
      .eq('visibility', 'owner')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const entries = (entriesData ?? []) as JournalEntryRow[]
  const entryIds = entries.map((entry) => entry.id)

  const [{ data: entryPetsData }, { data: mediaRows }] = await Promise.all([
    entryIds.length > 0
      ? admin
          .from('journal_entry_pets')
          .select('entry_id, pet_id')
          .eq('store_id', portalLink.store_id)
          .in('entry_id', entryIds)
      : Promise.resolve({ data: [] as EntryPetRow[] }),
    entryIds.length > 0
      ? admin
          .from('journal_media')
          .select('entry_id, id, media_type, storage_key, thumbnail_key, duration_sec, sort_order')
          .eq('store_id', portalLink.store_id)
          .in('entry_id', entryIds)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as JournalMediaRow[] }),
  ])

  const petIds = Array.from(new Set(((entryPetsData ?? []) as EntryPetRow[]).map((row) => row.pet_id))).filter(Boolean)
  const { data: petRows } =
    petIds.length > 0
      ? await admin.from('pets').select('id, name').eq('store_id', portalLink.store_id).in('id', petIds)
      : { data: [] as PetRow[] }

  const petNameMap = new Map(((petRows ?? []) as PetRow[]).map((pet) => [pet.id, pet.name ?? '名称未設定']))
  const petIdsByEntryId = new Map<string, string[]>()
  for (const row of (entryPetsData ?? []) as EntryPetRow[]) {
    const current = petIdsByEntryId.get(row.entry_id) ?? []
    current.push(row.pet_id)
    petIdsByEntryId.set(row.entry_id, current)
  }
  const mediaByEntryId = new Map<string, JournalMediaRow[]>()
  for (const row of (mediaRows ?? []) as JournalMediaRow[]) {
    const current = mediaByEntryId.get(row.entry_id) ?? []
    current.push(row)
    mediaByEntryId.set(row.entry_id, current)
  }
  const photoKeys = ((mediaRows ?? []) as JournalMediaRow[])
    .filter((row) => row.media_type === 'photo')
    .map((row) => row.storage_key)
  const videoKeys = ((mediaRows ?? []) as JournalMediaRow[])
    .filter((row) => row.media_type === 'video')
    .map((row) => row.storage_key)
  const [photoUrlMap, videoUrlMap] = await Promise.all([
    createSignedPhotoUrlMap(admin, photoKeys, 60 * 30),
    createSignedVideoUrlMap(admin, videoKeys, 60 * 30),
  ])

  return {
    customerName: customer?.full_name ?? 'お客様',
    expiresAt: portalLink.expires_at,
    entries: entries.map((entry) => ({
      ...entry,
      petNames: (petIdsByEntryId.get(entry.id) ?? []).map((petId) => petNameMap.get(petId) ?? '名称未設定'),
      media: (mediaByEntryId.get(entry.id) ?? []).map((item) => ({
        ...item,
        signed_url:
          item.media_type === 'photo'
            ? (photoUrlMap.get(item.storage_key) ?? null)
            : (videoUrlMap.get(item.storage_key) ?? null),
      })),
    })),
  }
}
