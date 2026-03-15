import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { normalizePlanCode, type AppPlan } from '@/lib/subscription-plan'

export type StorageLimitPolicy = 'block' | 'cleanup_orphans'

type StorageObjectRow = {
  id?: string | null
  name: string
  created_at: string | null
  metadata: { size?: number | string } | null
}

export type StoreStoragePolicyRow = {
  store_id: string
  policy: StorageLimitPolicy
  extra_capacity_gb: number
  custom_limit_mb: number | null
}

export type StoreStorageQuotaState = {
  storeId: string
  planCode: AppPlan
  policy: StorageLimitPolicy
  usageBytes: number
  usageUnavailable: boolean
  usageFetchError: string | null
  baseLimitBytes: number
  extraCapacityBytes: number
  customLimitBytes: number | null
  totalLimitBytes: number
}

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

export const PLAN_STORAGE_LIMIT_BYTES: Record<AppPlan, number> = {
  light: 5 * GB,
  standard: 10 * GB,
  pro: 20 * GB,
}

function toSafeInt(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function parseObjectSize(row: StorageObjectRow): number {
  const raw = row.metadata?.size
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw))
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) return Math.max(0, parsed)
  }
  return 0
}

async function fetchStoreStorageObjects(params: { storeId: string; bucket: string }) {
  const admin = createAdminSupabaseClient()
  const allRows: StorageObjectRow[] = []
  const pageSize = 100

  async function listFolder(path: string) {
    for (let page = 0; page < 200; page += 1) {
      const offset = page * pageSize
      const { data, error } = await admin.storage.from(params.bucket).list(path, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(error.message)

      const rows = (data ?? []) as StorageObjectRow[]
      for (const row of rows) {
        const childPath = path ? `${path}/${row.name}` : row.name
        const isFolder = !row.id || row.metadata === null
        if (isFolder) {
          await listFolder(childPath)
          continue
        }
        allRows.push({
          ...row,
          name: childPath,
        })
      }

      if (rows.length < pageSize) break
    }
  }

  await listFolder(params.storeId)
  return allRows
}

async function fetchReferencedMedicalPhotoPaths(storeId: string) {
  const admin = createAdminSupabaseClient()
  const referenced = new Set<string>()

  const [{ data: rows1, error: error1 }, { data: rows2, error: error2 }] = await Promise.all([
    admin.from('medical_record_photos').select('storage_path').eq('store_id', storeId),
    admin.from('medical_records').select('photos').eq('store_id', storeId),
  ])

  if (error1) throw new Error(error1.message)
  if (error2) throw new Error(error2.message)

  ;((rows1 ?? []) as Array<{ storage_path: string | null }>).forEach((row) => {
    if (typeof row.storage_path === 'string' && row.storage_path.length > 0) {
      referenced.add(row.storage_path)
    }
  })

  ;((rows2 ?? []) as Array<{ photos: string[] | null }>).forEach((row) => {
    if (!Array.isArray(row.photos)) return
    row.photos.forEach((path) => {
      if (typeof path === 'string' && path.length > 0) {
        referenced.add(path)
      }
    })
  })

  return referenced
}

export function formatBytesToJa(bytes: number) {
  const value = Math.max(0, bytes)
  if (value >= GB) return `${(value / GB).toFixed(2)} GB`
  if (value >= MB) return `${(value / MB).toFixed(2)} MB`
  return `${value} B`
}

export async function fetchStoreStorageQuotaState(params: {
  storeId: string
  bucket: string
  allowPartialUsageFailure?: boolean
}) {
  const admin = createAdminSupabaseClient()
  const objectListingPromise = fetchStoreStorageObjects({ storeId: params.storeId, bucket: params.bucket })
  const safeObjectListingPromise = (
    params.allowPartialUsageFailure
      ? Promise.race([
          objectListingPromise,
          new Promise<StorageObjectRow[]>((_, reject) => {
            setTimeout(() => reject(new Error('ストレージ集計がタイムアウトしました')), 5000)
          }),
        ])
      : objectListingPromise
  )
  const [{ data: sub }, { data: policyRow }, objectsResult] = await Promise.all([
    admin.from('store_subscriptions').select('plan_code').eq('store_id', params.storeId).maybeSingle(),
    admin
      .from('store_storage_policies')
      .select('store_id, policy, extra_capacity_gb, custom_limit_mb')
      .eq('store_id', params.storeId)
      .maybeSingle(),
    safeObjectListingPromise
      .then((rows) => ({ rows, error: null as string | null }))
      .catch((error: unknown) => {
        if (!params.allowPartialUsageFailure) throw error
        return {
          rows: [] as StorageObjectRow[],
          error: error instanceof Error ? error.message : '容量の取得に失敗しました',
        }
      }),
  ])

  const planCode = normalizePlanCode(sub?.plan_code)
  const policy = (policyRow?.policy ?? 'block') as StorageLimitPolicy
  const extraCapacityGb = toSafeInt(policyRow?.extra_capacity_gb, 0)
  const customLimitMb = typeof policyRow?.custom_limit_mb === 'number' ? toSafeInt(policyRow.custom_limit_mb) : null
  const usageBytes = objectsResult.rows.reduce((sum, row) => sum + parseObjectSize(row), 0)
  const baseLimitBytes = PLAN_STORAGE_LIMIT_BYTES[planCode]
  const extraCapacityBytes = extraCapacityGb * GB
  const customLimitBytes = customLimitMb !== null ? customLimitMb * MB : null
  const totalLimitBytes = customLimitBytes ?? baseLimitBytes + extraCapacityBytes

  return {
    storeId: params.storeId,
    planCode,
    policy,
    usageBytes,
    usageUnavailable: objectsResult.error !== null,
    usageFetchError: objectsResult.error,
    baseLimitBytes,
    extraCapacityBytes,
    customLimitBytes,
    totalLimitBytes,
  } satisfies StoreStorageQuotaState
}

export async function upsertStoreStoragePolicy(params: {
  storeId: string
  policy: StorageLimitPolicy
  extraCapacityGb: number
  customLimitMb: number | null
  updatedByUserId: string
}) {
  const admin = createAdminSupabaseClient()
  const payload = {
    store_id: params.storeId,
    policy: params.policy,
    extra_capacity_gb: Math.max(0, Math.floor(params.extraCapacityGb)),
    custom_limit_mb:
      typeof params.customLimitMb === 'number' && Number.isFinite(params.customLimitMb)
        ? Math.max(0, Math.floor(params.customLimitMb))
        : null,
    updated_by_user_id: params.updatedByUserId,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from('store_storage_policies').upsert(payload, { onConflict: 'store_id' })
  if (error) throw new Error(error.message)
}

export async function addStoreExtraCapacityGb(params: {
  storeId: string
  addGb: number
  updatedByUserId?: string | null
}) {
  const addGb = Math.max(0, Math.floor(params.addGb))
  if (addGb <= 0) return
  const admin = createAdminSupabaseClient()
  const { data: existing, error: fetchError } = await admin
    .from('store_storage_policies')
    .select('extra_capacity_gb')
    .eq('store_id', params.storeId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)

  const nextExtraGb = Math.max(0, Math.floor((existing?.extra_capacity_gb ?? 0) + addGb))
  const { error } = await admin.from('store_storage_policies').upsert(
    {
      store_id: params.storeId,
      extra_capacity_gb: nextExtraGb,
      updated_by_user_id: params.updatedByUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id' }
  )
  if (error) throw new Error(error.message)
}

export async function setStoreExtraCapacityGb(params: {
  storeId: string
  extraCapacityGb: number
  updatedByUserId?: string | null
}) {
  const normalizedExtraGb = Math.max(0, Math.floor(params.extraCapacityGb))
  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('store_storage_policies').upsert(
    {
      store_id: params.storeId,
      extra_capacity_gb: normalizedExtraGb,
      updated_by_user_id: params.updatedByUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id' }
  )
  if (error) throw new Error(error.message)
}

export async function ensureStoreHasStorageCapacity(params: {
  storeId: string
  bucket: string
  incomingBytes: number
}) {
  const incomingBytes = Math.max(0, Math.floor(params.incomingBytes))
  const quota = await fetchStoreStorageQuotaState({
    storeId: params.storeId,
    bucket: params.bucket,
  })
  const projectedBytes = quota.usageBytes + incomingBytes
  if (projectedBytes <= quota.totalLimitBytes) {
    return { allowed: true as const, quota, cleanedUpCount: 0, freedBytes: 0 }
  }

  if (quota.policy === 'cleanup_orphans') {
    const [objects, referencedPaths] = await Promise.all([
      fetchStoreStorageObjects({ storeId: params.storeId, bucket: params.bucket }),
      fetchReferencedMedicalPhotoPaths(params.storeId),
    ])

    const removable = objects.filter((row) => !referencedPaths.has(row.name))
    let removableBytes = 0
    const removeTargets: string[] = []
    const needToFree = projectedBytes - quota.totalLimitBytes

    for (const row of removable) {
      removeTargets.push(row.name)
      removableBytes += parseObjectSize(row)
      if (removableBytes >= needToFree) break
    }

    if (removeTargets.length > 0) {
      const admin = createAdminSupabaseClient()
      const { error } = await admin.storage.from(params.bucket).remove(removeTargets)
      if (error) throw new Error(error.message)
    }

    const usageAfterBytes = Math.max(0, quota.usageBytes - removableBytes)
    const projectedAfterBytes = usageAfterBytes + incomingBytes
    if (projectedAfterBytes <= quota.totalLimitBytes) {
      return {
        allowed: true as const,
        quota: {
          ...quota,
          usageBytes: usageAfterBytes,
        },
        cleanedUpCount: removeTargets.length,
        freedBytes: removableBytes,
      }
    }
  }

  return { allowed: false as const, quota, cleanedUpCount: 0, freedBytes: 0 }
}
