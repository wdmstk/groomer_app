import { isObjectRecord } from '@/lib/object-utils'

const VIDEO_STORAGE_BUCKET = process.env.SUPABASE_VIDEO_UPLOAD_BUCKET ?? 'pet-videos'

export type MedicalRecordVideoSourceType = 'uploaded' | 'ai_generated'

export type MedicalRecordVideoDraft = {
  id?: string
  storagePath: string
  thumbnailPath?: string | null
  lineShortPath?: string | null
  durationSec: number | null
  sizeBytes: number | null
  sourceType: MedicalRecordVideoSourceType
  comment: string
  sortOrder: number
  takenAt: string | null
  signedUrl?: string | null
}

type StorageSigner = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
}

function asRecord(value: unknown): { [key: string]: unknown } | null {
  if (!isObjectRecord(value)) return null
  return value
}

function toJstDateParts(value: string | null | undefined) {
  const base = value ? new Date(value) : new Date()
  const date = Number.isNaN(base.getTime()) ? new Date() : base
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: map.year ?? '0000',
    month: map.month ?? '01',
    day: map.day ?? '01',
  }
}

function toNullableNonNegativeInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

export function getMedicalRecordVideoBucket() {
  return VIDEO_STORAGE_BUCKET
}

export function buildMedicalRecordVideoFolder(params: {
  storeId: string
  petId: string
  recordDate: string | null | undefined
}) {
  const date = toJstDateParts(params.recordDate)
  return `${params.storeId}/pets/${params.petId}/visit-date/${date.year}-${date.month}-${date.day}/video`
}

export function buildMedicalRecordLineShortVideoPath(params: {
  storeId: string
  medicalRecordId: string
  sourcePath: string
}) {
  const extRaw = params.sourcePath.split('.').pop()?.toLowerCase() ?? 'mp4'
  const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'mp4'
  return `${params.storeId}/medical-records/${params.medicalRecordId}/line-short/${Date.now()}-${crypto.randomUUID()}.${ext}`
}

export function buildMedicalRecordVideoThumbnailPath(params: {
  storeId: string
  medicalRecordId: string
  sourcePath: string
}) {
  const extRaw = params.sourcePath.split('.').pop()?.toLowerCase() ?? 'jpg'
  const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${params.storeId}/medical-records/${params.medicalRecordId}/thumbnail/${Date.now()}-${crypto.randomUUID()}.${ext}`
}

export function parseMedicalRecordVideoDrafts(value: string | null | undefined) {
  if (!value) return [] as MedicalRecordVideoDraft[]

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    const rows: MedicalRecordVideoDraft[] = []

    parsed.forEach((item, index) => {
      const row = asRecord(item)
      if (!row) return
      const storagePath = typeof row.storagePath === 'string' ? row.storagePath.trim() : ''
      if (!storagePath) return
      const sourceType = row.sourceType === 'ai_generated' ? 'ai_generated' : 'uploaded'

      rows.push({
        id: typeof row.id === 'string' ? row.id : undefined,
        storagePath,
        thumbnailPath: typeof row.thumbnailPath === 'string' ? row.thumbnailPath : null,
        lineShortPath: typeof row.lineShortPath === 'string' ? row.lineShortPath : null,
        durationSec: toNullableNonNegativeInt(row.durationSec),
        sizeBytes: toNullableNonNegativeInt(row.sizeBytes),
        sourceType,
        comment: typeof row.comment === 'string' ? row.comment : '',
        sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
        takenAt: typeof row.takenAt === 'string' && row.takenAt ? row.takenAt : null,
      })
    })

    return rows.sort((a, b) => a.sortOrder - b.sortOrder)
  } catch {
    return []
  }
}

export async function createSignedVideoUrlMap(
  signer: StorageSigner,
  storagePaths: string[],
  expiresIn = 60 * 60
) {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)))
  const result = new Map<string, string>()

  await Promise.all(
    uniquePaths.map(async (storagePath) => {
      const { data } = await signer.storage
        .from(VIDEO_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn)

      if (data?.signedUrl) {
        result.set(storagePath, data.signedUrl)
      }
    })
  )

  return result
}
