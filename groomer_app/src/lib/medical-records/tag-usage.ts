import { getMedicalRecordAiTagStatusLabel, parseMedicalRecordTags } from '@/lib/medical-records/tags.ts'

export type MedicalRecordAiFilterStatus = 'all' | 'queued' | 'processing' | 'completed' | 'failed' | 'idle'

export type MedicalRecordTagUsageRecord = {
  ai_tag_status: string | null
  tags: string[] | null
}

const PRIORITY_ORDER = new Map<string, number>([
  ['毛玉:多', 0],
  ['毛玉:中', 1],
  ['皮膚状態:赤み', 2],
  ['皮膚状態:乾燥', 3],
  ['耳汚れ', 4],
  ['涙やけ', 5],
  ['毛玉:少', 6],
  ['皮膚状態:正常', 7],
])

function compareTags(left: string, right: string) {
  const leftRank = PRIORITY_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER
  const rightRank = PRIORITY_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER
  if (leftRank !== rightRank) return leftRank - rightRank
  return left.localeCompare(right, 'ja')
}

export function sortMedicalRecordTags(tags: string[] | null | undefined) {
  return [...(parseMedicalRecordTags(tags ?? null) ?? [])].sort(compareTags)
}

export function getVisibleMedicalRecordTags(tags: string[] | null | undefined, limit = 3) {
  return sortMedicalRecordTags(tags).slice(0, limit)
}

export function buildMedicalRecordTagFilterOptions(records: MedicalRecordTagUsageRecord[]) {
  const counts = new Map<string, number>()

  for (const record of records) {
    for (const tag of sortMedicalRecordTags(record.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort(([leftTag, leftCount], [rightTag, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount
      return compareTags(leftTag, rightTag)
    })
    .map(([tag, count]) => ({ tag, count }))
}

export function filterMedicalRecordsByAi<
  T extends MedicalRecordTagUsageRecord,
>(records: T[], filters: { status: MedicalRecordAiFilterStatus; tag: string }) {
  return records.filter((record) => {
    const normalizedTags = sortMedicalRecordTags(record.tags)
    const matchesStatus = filters.status === 'all' ? true : (record.ai_tag_status ?? 'idle') === filters.status
    const matchesTag = filters.tag ? normalizedTags.includes(filters.tag) : true
    return matchesStatus && matchesTag
  })
}

export function getMedicalRecordAiStatusOptions(records: MedicalRecordTagUsageRecord[]) {
  const counts = new Map<MedicalRecordAiFilterStatus, number>([['all', records.length]])

  for (const record of records) {
    const status = (record.ai_tag_status ?? 'idle') as Exclude<MedicalRecordAiFilterStatus, 'all'>
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return (['all', 'failed', 'queued', 'processing', 'completed', 'idle'] as const).map((status) => ({
    value: status,
    label: status === 'all' ? 'すべて' : getMedicalRecordAiTagStatusLabel(status),
    count: counts.get(status) ?? 0,
  }))
}
