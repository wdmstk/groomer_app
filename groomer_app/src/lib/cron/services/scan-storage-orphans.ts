import { getMedicalRecordPhotoBucket } from '@/lib/medical-records/photos'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type StorageObjectRow = {
  name: string
  created_at: string | null
  updated_at: string | null
}

type MedicalRecordPhotoRow = {
  storage_path: string | null
}

type MedicalRecordRow = {
  photos: string[] | null
}

const PAGE_SIZE = 1000

function resolveGraceHours() {
  const raw = process.env.STORAGE_ORPHAN_SCAN_MIN_AGE_HOURS
  const value = raw ? Number(raw) : 24
  if (!Number.isFinite(value) || value < 0) return 24
  return Math.floor(value)
}

function isOlderThanThreshold(value: string | null, minAgeMs: number) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return false
  return Date.now() - time >= minAgeMs
}

function toStoreId(path: string) {
  return path.split('/')[0] ?? 'unknown'
}

async function fetchAllMedicalRecordPhotoPaths() {
  const admin = createAdminSupabaseClient()
  const result = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await admin
      .from('medical_record_photos')
      .select('storage_path')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch medical_record_photos: ${error.message}`)
    }

    const rows = (data ?? []) as MedicalRecordPhotoRow[]
    rows.forEach((row) => {
      if (typeof row.storage_path === 'string' && row.storage_path) {
        result.add(row.storage_path)
      }
    })

    if (rows.length < PAGE_SIZE) break
  }

  return result
}

async function fetchAllMedicalRecordArrayPaths() {
  const admin = createAdminSupabaseClient()
  const result = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await admin
      .from('medical_records')
      .select('photos')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch medical_records.photos: ${error.message}`)
    }

    const rows = (data ?? []) as MedicalRecordRow[]
    rows.forEach((row) => {
      if (!Array.isArray(row.photos)) return
      row.photos.forEach((path) => {
        if (typeof path === 'string' && path) {
          result.add(path)
        }
      })
    })

    if (rows.length < PAGE_SIZE) break
  }

  return result
}

async function fetchAllStorageObjects(bucket: string) {
  const admin = createAdminSupabaseClient()
  const result: StorageObjectRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await admin
      .schema('storage')
      .from('objects')
      .select('name, created_at, updated_at')
      .eq('bucket_id', bucket)
      .order('name', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch storage.objects: ${error.message}`)
    }

    const rows = (data ?? []) as StorageObjectRow[]
    result.push(...rows)

    if (rows.length < PAGE_SIZE) break
  }

  return result
}

export async function runScanStorageOrphansJob() {
  const bucket = getMedicalRecordPhotoBucket()
  const graceHours = resolveGraceHours()
  const minAgeMs = graceHours * 60 * 60 * 1000

  const [photoPaths, recordArrayPaths, storageObjects] = await Promise.all([
    fetchAllMedicalRecordPhotoPaths(),
    fetchAllMedicalRecordArrayPaths(),
    fetchAllStorageObjects(bucket),
  ])

  const referencedPaths = new Set<string>([...photoPaths, ...recordArrayPaths])
  const orphanObjects = storageObjects.filter((row) => {
    if (!row.name) return false
    if (referencedPaths.has(row.name)) return false
    return isOlderThanThreshold(row.updated_at ?? row.created_at, minAgeMs)
  })

  const orphanCountByStore = orphanObjects.reduce(
    (acc, row) => {
      const storeId = toStoreId(row.name)
      acc[storeId] = (acc[storeId] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    bucket,
    graceHours,
    scannedObjectCount: storageObjects.length,
    referencedPathCount: referencedPaths.size,
    orphanCount: orphanObjects.length,
    counters: {
      scannedObjectCount: storageObjects.length,
      referencedPathCount: referencedPaths.size,
      orphanCount: orphanObjects.length,
      affectedStoreCount: Object.keys(orphanCountByStore).length,
    },
    orphanCountByStore,
    sampleOrphans: orphanObjects.slice(0, 50).map((row) => ({
      path: row.name,
      storeId: toStoreId(row.name),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
}
