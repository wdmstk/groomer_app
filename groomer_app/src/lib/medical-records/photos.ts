import { isObjectRecord } from '@/lib/object-utils'

const STORAGE_BUCKET = process.env.SUPABASE_UPLOAD_BUCKET ?? 'pet-photos'

export type MedicalRecordPhotoType = 'before' | 'after'

export type MedicalRecordPhotoDraft = {
  id?: string
  photoType: MedicalRecordPhotoType
  storagePath: string
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

export function getMedicalRecordPhotoBucket() {
  return STORAGE_BUCKET
}

export function buildMedicalRecordPhotoFolder(params: {
  storeId: string
  petId: string
  recordDate: string | null | undefined
  photoType: MedicalRecordPhotoType
}) {
  const date = toJstDateParts(params.recordDate)
  return `${params.storeId}/pets/${params.petId}/visit-date/${date.year}-${date.month}-${date.day}/${params.photoType}`
}

export function parseMedicalRecordPhotoDrafts(value: string | null | undefined) {
  if (!value) return [] as MedicalRecordPhotoDraft[]

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    const rows: MedicalRecordPhotoDraft[] = []

    parsed.forEach((item, index) => {
      const row = asRecord(item)
      if (!row) return
      const photoType = row.photoType === 'after' ? 'after' : row.photoType === 'before' ? 'before' : null
      const storagePath = typeof row.storagePath === 'string' ? row.storagePath.trim() : ''
      if (!photoType || !storagePath) return

      rows.push({
        id: typeof row.id === 'string' ? row.id : undefined,
        photoType,
        storagePath,
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

export async function createSignedPhotoUrlMap(
  signer: StorageSigner,
  storagePaths: string[],
  expiresIn = 60 * 60
) {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)))
  const result = new Map<string, string>()

  await Promise.all(
    uniquePaths.map(async (storagePath) => {
      const { data } = await signer.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn)

      if (data?.signedUrl) {
        result.set(storagePath, data.signedUrl)
      }
    })
  )

  return result
}
