import Link from 'next/link'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { createSignedPhotoUrlMap } from '@/lib/medical-records/photos'
import { createSignedVideoUrlMap } from '@/lib/medical-records/videos'
import { journalPageFixtures } from '@/lib/e2e/journal-page-fixtures'

type RouteProps = {
  params: Promise<{
    pet_id: string
  }>
}

type JournalEntryRow = {
  id: string
  body_text: string
  visibility: string
  posted_at: string | null
  created_at: string
}

type JournalMediaRow = {
  entry_id: string
  id: string
  media_type: 'photo' | 'video'
  storage_key: string
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PetJournalAlbumPage({ params }: RouteProps) {
  const { pet_id: petId } = await params
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: journalPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>

  const pet = isPlaywrightE2E
    ? journalPageFixtures.pets.find((row) => row.id === petId) ?? null
    : (
        await db
          .from('pets')
          .select('id, name')
          .eq('store_id', storeId)
          .eq('id', petId)
          .maybeSingle()
      ).data

  if (!pet) {
    notFound()
  }

  const mappings = isPlaywrightE2E
    ? journalPageFixtures.entryPets.filter((row) => row.pet_id === petId)
    : (
        await db
          .from('journal_entry_pets')
          .select('entry_id')
          .eq('store_id', storeId)
          .eq('pet_id', petId)
      ).data ?? []

  const entryIds = mappings.map((row) => String(row.entry_id)).filter(Boolean)
  const { data: entriesData } =
    isPlaywrightE2E
      ? {
          data: journalPageFixtures.entries.filter((entry) => entryIds.includes(entry.id)) as JournalEntryRow[],
        }
      : entryIds.length > 0
      ? await db
          .from('journal_entries')
          .select('id, body_text, visibility, posted_at, created_at')
          .eq('store_id', storeId)
          .eq('status', 'published')
          .in('id', entryIds)
          .order('posted_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
      : { data: [] as JournalEntryRow[] }

  const entries = (entriesData ?? []) as JournalEntryRow[]
  const { data: mediaData } =
    isPlaywrightE2E
      ? {
          data: journalPageFixtures.media.filter((media) => entries.some((entry) => entry.id === media.entry_id)) as JournalMediaRow[],
        }
      : entries.length > 0
      ? await db
          .from('journal_media')
          .select('entry_id, id, media_type, storage_key')
          .eq('store_id', storeId)
          .in(
            'entry_id',
            entries.map((entry) => entry.id),
          )
      : { data: [] as JournalMediaRow[] }

  const mediaByEntryId = new Map<string, JournalMediaRow[]>()
  for (const row of (mediaData ?? []) as JournalMediaRow[]) {
    const current = mediaByEntryId.get(row.entry_id) ?? []
    current.push(row)
    mediaByEntryId.set(row.entry_id, current)
  }
  const photoKeys = ((mediaData ?? []) as JournalMediaRow[])
    .filter((row) => row.media_type === 'photo')
    .map((row) => row.storage_key)
  const videoKeys = ((mediaData ?? []) as JournalMediaRow[])
    .filter((row) => row.media_type === 'video')
    .map((row) => row.storage_key)
  const [photoUrlMap, videoUrlMap] = isPlaywrightE2E
    ? [new Map<string, string>(), new Map<string, string>()]
    : await Promise.all([
        createSignedPhotoUrlMap(db, photoKeys, 60 * 30),
        createSignedVideoUrlMap(db, videoKeys, 60 * 30),
      ])

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <header className="space-y-2">
        <p>
          <Link href="/pets" className="text-sm text-sky-700 underline hover:text-sky-800">
            ペット管理へ戻る
          </Link>
        </p>
        <h1 className="text-xl font-bold text-gray-900">{pet.name ?? '名称未設定'}の日誌アルバム</h1>
        <p className="text-sm text-gray-500">公開済みの日誌のみを時系列で表示します。</p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          まだ日誌投稿はありません。
        </p>
      ) : (
        <section className="space-y-2">
          {entries.map((entry) => {
            const media = mediaByEntryId.get(entry.id) ?? []
            const photoCount = media.filter((item) => item.media_type === 'photo').length
            const videoCount = media.filter((item) => item.media_type === 'video').length
            return (
              <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{formatDateTime(entry.posted_at ?? entry.created_at)}</span>
                  <span className="rounded bg-gray-100 px-2 py-1 text-[11px]">{entry.visibility}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{entry.body_text || '（コメントなし）'}</p>
                <p className="mt-2 text-xs text-gray-500">
                  写真 {photoCount} 件 / 動画 {videoCount} 件
                </p>
                {media.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {media.map((item) => {
                      const signedUrl =
                        item.media_type === 'photo'
                          ? (photoUrlMap.get(item.storage_key) ?? null)
                          : (videoUrlMap.get(item.storage_key) ?? null)
                      if (!signedUrl) return null
                      return item.media_type === 'photo' ? (
                        <div key={item.id} className="relative aspect-square overflow-hidden rounded border border-gray-200">
                          <Image
                            src={signedUrl}
                            alt="日誌写真"
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <video
                          key={item.id}
                          src={signedUrl}
                          controls
                          playsInline
                          className="w-full rounded border border-gray-200 bg-black"
                        />
                      )
                    })}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
