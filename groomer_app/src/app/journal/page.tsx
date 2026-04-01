import JournalComposer from '@/components/journal/JournalComposer'
import { createStoreScopedClient } from '@/lib/supabase/store'
import { journalPageFixtures } from '@/lib/e2e/journal-page-fixtures'

type CustomerRow = {
  id: string
  full_name: string | null
}

type PetRow = {
  id: string
  name: string | null
  customer_id: string | null
}

type JournalEntryRow = {
  id: string
  customer_id: string | null
  status: string
  body_text: string
  visibility: string
  posted_at: string | null
  created_at: string
}

type EntryPetRow = {
  entry_id: string
  pet_id: string
}

function formatDateTime(value: string | null) {
  if (!value) return '未公開'
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

export default async function JournalPage() {
  const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === '1'
  const { supabase, storeId } = isPlaywrightE2E
    ? { supabase: null, storeId: journalPageFixtures.storeId }
    : await createStoreScopedClient()
  const db = supabase as NonNullable<typeof supabase>

  const [customers, pets, entries] = isPlaywrightE2E
    ? [journalPageFixtures.customers, journalPageFixtures.pets, journalPageFixtures.entries]
    : await Promise.all([
        db.from('customers').select('id, full_name').eq('store_id', storeId).order('full_name', { ascending: true }).then((res) => res.data ?? []),
        db.from('pets').select('id, name, customer_id').eq('store_id', storeId).order('name', { ascending: true }).then((res) => res.data ?? []),
        db
          .from('journal_entries')
          .select('id, customer_id, status, body_text, visibility, posted_at, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(50)
          .then((res) => res.data ?? []),
      ])

  const entryIds = (entries as JournalEntryRow[]).map((entry) => entry.id)
  const { data: entryPets } =
    isPlaywrightE2E
      ? { data: journalPageFixtures.entryPets as EntryPetRow[] }
      : entryIds.length > 0
      ? await db
          .from('journal_entry_pets')
          .select('entry_id, pet_id')
          .eq('store_id', storeId)
          .in('entry_id', entryIds)
      : { data: [] as EntryPetRow[] }

  const customerNameMap = new Map((customers as CustomerRow[]).map((row) => [row.id, row.full_name ?? '名称未設定']))
  const petNameMap = new Map((pets as PetRow[]).map((row) => [row.id, row.name ?? '名称未設定']))
  const petIdsByEntryId = new Map<string, string[]>()
  for (const row of (entryPets ?? []) as EntryPetRow[]) {
    const current = petIdsByEntryId.get(row.entry_id) ?? []
    current.push(row.pet_id)
    petIdsByEntryId.set(row.entry_id, current)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold text-gray-900">日誌</h1>
        <p className="text-sm text-gray-500">写真・動画カルテとは独立した日誌モジュールです。</p>
      </header>

      <JournalComposer customers={customers as CustomerRow[]} pets={pets as PetRow[]} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">最新投稿</h2>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">投稿はまだありません。</p>
        ) : (
          (entries as JournalEntryRow[]).map((entry) => {
            const petNames = (petIdsByEntryId.get(entry.id) ?? [])
              .map((petId) => petNameMap.get(petId) ?? '名称未設定')
              .join(' / ')
            const customerName = entry.customer_id ? customerNameMap.get(entry.customer_id) ?? '名称未設定' : '未設定'

            return (
              <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{formatDateTime(entry.posted_at ?? entry.created_at)}</span>
                  <span className="rounded bg-gray-100 px-2 py-1 text-[11px]">{entry.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-900">顧客: {customerName}</p>
                <p className="text-sm text-gray-700">対象: {petNames || '未設定'}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{entry.body_text || '（コメントなし）'}</p>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
