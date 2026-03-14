import { NextResponse } from 'next/server'
import { requireOwnerStoreMembership } from '@/lib/auth/store-owner'
import {
  type StorageLimitPolicy,
  upsertStoreStoragePolicy,
} from '@/lib/storage-quota'
import { asObjectOrNull } from '@/lib/object-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parsePolicy(value: unknown): StorageLimitPolicy {
  return value === 'cleanup_orphans' ? 'cleanup_orphans' : 'block'
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return Math.max(0, parsed)
  }
  return null
}

export async function POST(request: Request) {
  const guard = await requireOwnerStoreMembership()
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const isForm = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
  const formData = isForm ? await request.formData() : null
  const bodyRaw: unknown = formData ? null : await request.json().catch(() => null)
  const body = asObjectOrNull(bodyRaw)

  const policy = parsePolicy(formData?.get('policy') ?? body?.policy)
  const extraCapacityGb = parseIntOrNull(formData?.get('extra_capacity_gb') ?? body?.extra_capacity_gb) ?? 0
  const customLimitMb = parseIntOrNull(formData?.get('custom_limit_mb') ?? body?.custom_limit_mb)
  const redirectToRaw = formData?.get('redirect_to')?.toString() ?? ''
  const redirectTo = redirectToRaw.trim() || '/settings/storage'

  try {
    await upsertStoreStoragePolicy({
      storeId: guard.storeId,
      policy,
      extraCapacityGb,
      customLimitMb,
      updatedByUserId: guard.user.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update storage policy.'
    if (!formData) {
      return NextResponse.json({ message }, { status: 500 })
    }
    const url = new URL(redirectTo, request.url)
    url.searchParams.set('error', message)
    return NextResponse.redirect(url)
  }

  if (!formData) {
    return NextResponse.json({ ok: true })
  }

  const url = new URL(redirectTo, request.url)
  url.searchParams.set('saved', '1')
  return NextResponse.redirect(url)
}
