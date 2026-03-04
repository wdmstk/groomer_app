export class StoreBootstrapServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StoreBootstrapServiceError'
    this.status = status
  }
}

export type StoreBootstrapUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: unknown
  }
}

export type StoreBootstrapDeps = {
  fetchActiveMembershipRoles(userId: string): Promise<string[]>
  createStore(storeName: string): Promise<{ id: string; name: string }>
  upsertTrialSubscription(params: { storeId: string; trialDays: number; trialStartedAt: string }): Promise<void>
  insertOwnerMembership(params: { storeId: string; userId: string }): Promise<void>
  insertOwnerStaff(params: {
    storeId: string
    userId: string
    email: string | null
    fullName: string
  }): Promise<void>
  deleteStore(storeId: string): Promise<void>
}

export function validateStoreBootstrapInput(storeName: string) {
  const normalized = storeName.trim()
  if (!normalized) {
    throw new StoreBootstrapServiceError('店舗名は必須です。')
  }
  if (normalized.length > 120) {
    throw new StoreBootstrapServiceError('店舗名は120文字以内で入力してください。')
  }
  return normalized
}

export async function bootstrapStoreCore(params: {
  storeName: string
  user: StoreBootstrapUser
  trialDays: number
  trialStartedAt: string
  deps: StoreBootstrapDeps
}) {
  const storeName = validateStoreBootstrapInput(params.storeName)
  const roles = await params.deps.fetchActiveMembershipRoles(params.user.id)
  const hasMembership = roles.length > 0
  const hasOwnerRole = roles.includes('owner')

  if (hasMembership && !hasOwnerRole) {
    throw new StoreBootstrapServiceError('新規店舗の作成は owner 権限ユーザーのみ実行できます。', 403)
  }

  const metadataName =
    typeof params.user.user_metadata?.full_name === 'string'
      ? params.user.user_metadata.full_name.trim()
      : ''
  const ownerFullName = metadataName || params.user.email?.split('@')[0] || 'owner'
  const ownerEmail = params.user.email?.toLowerCase() ?? null

  const store = await params.deps.createStore(storeName)
  try {
    await params.deps.upsertTrialSubscription({
      storeId: store.id,
      trialDays: Math.max(0, params.trialDays),
      trialStartedAt: params.trialStartedAt,
    })
    await params.deps.insertOwnerMembership({
      storeId: store.id,
      userId: params.user.id,
    })
    await params.deps.insertOwnerStaff({
      storeId: store.id,
      userId: params.user.id,
      email: ownerEmail,
      fullName: ownerFullName,
    })
  } catch (error) {
    await params.deps.deleteStore(store.id)
    throw error
  }

  return {
    message: '店舗を作成しました。',
    storeId: store.id,
    storeName: store.name,
  }
}
