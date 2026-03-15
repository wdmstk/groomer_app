import { isObjectRecord } from '@/lib/object-utils'

export const DEFAULT_MAT_LEVEL_TAG = '毛玉:少'
export const DEFAULT_SKIN_STATUS_TAG = '皮膚状態:正常'
export const AI_TAG_PROVIDER = 'rule_based_v1'

export type MedicalRecordAiTagStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed'

export type MedicalRecordAiTagContext = {
  skinCondition?: string | null
  behaviorNotes?: string | null
  cautionNotes?: string | null
  photoComments?: string[]
}

function normalizeTag(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseMedicalRecordTags(value: string | string[] | null | undefined) {
  if (!value) return null

  const parts = Array.isArray(value)
    ? value
    : value
        .split(/[\n,、]/)
        .map((item) => item.trim())

  const tags = Array.from(
    new Set(
      parts
        .map((item) => normalizeTag(item))
        .filter(Boolean)
    )
  )

  return tags.length > 0 ? tags : null
}

function includesKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function inferMedicalRecordTags(context: MedicalRecordAiTagContext) {
  const sourceText = [
    context.skinCondition ?? '',
    context.behaviorNotes ?? '',
    context.cautionNotes ?? '',
    ...(context.photoComments ?? []),
  ]
    .join('\n')
    .toLowerCase()

  const tags = new Set<string>()

  if (includesKeyword(sourceText, ['重度毛玉', '毛玉多', '毛玉が多', 'フェルト', 'もつれ多'])) {
    tags.add('毛玉:多')
  } else if (includesKeyword(sourceText, ['毛玉中', '毛玉あり', 'もつれ'])) {
    tags.add('毛玉:中')
  } else {
    tags.add(DEFAULT_MAT_LEVEL_TAG)
  }

  if (includesKeyword(sourceText, ['赤み', '発赤', '赤く', '炎症'])) {
    tags.add('皮膚状態:赤み')
  } else if (includesKeyword(sourceText, ['乾燥', 'かさつき', 'フケ'])) {
    tags.add('皮膚状態:乾燥')
  } else {
    tags.add(DEFAULT_SKIN_STATUS_TAG)
  }

  if (includesKeyword(sourceText, ['耳汚れ', '耳垢', '耳の汚れ'])) {
    tags.add('耳汚れ')
  }
  if (includesKeyword(sourceText, ['涙やけ', '涙焼け', '目元汚れ'])) {
    tags.add('涙やけ')
  }

  return Array.from(tags)
}

export function normalizeMedicalRecordAiTagStatus(
  value: string | null | undefined
): MedicalRecordAiTagStatus {
  switch (value) {
    case 'queued':
    case 'processing':
    case 'completed':
    case 'failed':
      return value
    default:
      return 'idle'
  }
}

export function getMedicalRecordAiTagStatusLabel(status: MedicalRecordAiTagStatus) {
  switch (status) {
    case 'queued':
      return '解析待ち'
    case 'processing':
      return '解析中'
    case 'completed':
      return '解析済み'
    case 'failed':
      return '解析失敗'
    default:
      return '未解析'
  }
}

export function getMedicalRecordAiTagStatusTone(status: MedicalRecordAiTagStatus) {
  switch (status) {
    case 'queued':
      return 'bg-amber-100 text-amber-800'
    case 'processing':
      return 'bg-sky-100 text-sky-800'
    case 'completed':
      return 'bg-emerald-100 text-emerald-800'
    case 'failed':
      return 'bg-rose-100 text-rose-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function parseMedicalRecordAiJobPayload(value: unknown) {
  if (!isObjectRecord(value)) return null
  return {
    action: typeof value.action === 'string' ? value.action.trim() : '',
  }
}
