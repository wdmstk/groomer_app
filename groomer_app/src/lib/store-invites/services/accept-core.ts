export class StoreInviteAcceptServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StoreInviteAcceptServiceError'
    this.status = status
  }
}

export type StoreInviteAcceptUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: unknown
  }
}

type StoreInviteRecord = {
  id: string
  store_id: string
  email: string
  role: string
  expires_at: string
  used_at: string | null
}

type StaffRecord = {
  id: string
  full_name: string | null
}

type StaffMutationPayload = {
  user_id: string | null
  email: string | null
  role: string
  full_name: string
}

type DuplicateLikeError = {
  code?: string | null
  message?: string | null
}

export type StoreInviteAcceptDeps = {
  fetchInviteByToken(token: string): Promise<StoreInviteRecord | null>
  upsertMembership(params: { storeId: string; userId: string; role: string }): Promise<void>
  findStaffByUserId(params: { storeId: string; userId: string }): Promise<StaffRecord | null>
  findStaffByEmail(params: { storeId: string; email: string }): Promise<StaffRecord | null>
  updateStaffById(params: { staffId: string; payload: StaffMutationPayload }): Promise<void>
  insertStaff(params: { storeId: string; payload: StaffMutationPayload }): Promise<void>
  consumeInvite(params: { inviteId: string; usedAt: string; usedBy: string }): Promise<void>
}

function isStaffEmailDuplicateError(error: DuplicateLikeError) {
  return error.code === '23505' && String(error.message ?? '').includes('staffs_email_key')
}

function isStaffUserIdDuplicateError(error: DuplicateLikeError) {
  return error.code === '23505' && String(error.message ?? '').includes('staffs_user_id_unique')
}

async function syncStaffRecord(params: {
  deps: StoreInviteAcceptDeps
  storeId: string
  user: StoreInviteAcceptUser
  email: string
  role: string
}) {
  const { deps, storeId, user, email, role } = params
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  const fallbackName = email.split('@')[0] || 'staff'
  const staffDisplayName = metadataName || fallbackName

  const existingStaffByUserId = await deps.findStaffByUserId({ storeId, userId: user.id })
  let targetStaffId = existingStaffByUserId?.id ?? null
  let targetStaffFullName = existingStaffByUserId?.full_name ?? null

  if (!targetStaffId) {
    const existingStaffByEmail = await deps.findStaffByEmail({ storeId, email })
    if (existingStaffByEmail?.id) {
      targetStaffId = existingStaffByEmail.id
      targetStaffFullName = existingStaffByEmail.full_name ?? null
    }
  }

  if (targetStaffId) {
    const nextFullName = targetStaffFullName?.trim() ? targetStaffFullName : staffDisplayName
    let payload: StaffMutationPayload = {
      user_id: user.id,
      email,
      role,
      full_name: nextFullName,
    }

    try {
      await deps.updateStaffById({ staffId: targetStaffId, payload })
      return
    } catch (error) {
      const dbError = error as DuplicateLikeError
      if (isStaffEmailDuplicateError(dbError)) {
        payload = { ...payload, email: null }
        try {
          await deps.updateStaffById({ staffId: targetStaffId, payload })
          return
        } catch (retryError) {
          error = retryError
        }
      }

      let dbRetryError = error as DuplicateLikeError
      if (isStaffUserIdDuplicateError(dbRetryError)) {
        payload = { ...payload, user_id: null }
        try {
          await deps.updateStaffById({ staffId: targetStaffId, payload })
          return
        } catch (retryError) {
          error = retryError
          dbRetryError = retryError as DuplicateLikeError
        }
      }

      if (isStaffEmailDuplicateError(dbRetryError) || isStaffUserIdDuplicateError(dbRetryError)) {
        payload = { ...payload, user_id: null, email: null }
        await deps.updateStaffById({ staffId: targetStaffId, payload })
        return
      }

      throw error
    }
  }

  let payload: StaffMutationPayload = {
    user_id: user.id,
    email,
    role,
    full_name: staffDisplayName,
  }

  try {
    await deps.insertStaff({ storeId, payload })
    return
  } catch (error) {
    const dbError = error as DuplicateLikeError
    if (isStaffEmailDuplicateError(dbError)) {
      payload = { ...payload, email: null }
      try {
        await deps.insertStaff({ storeId, payload })
        return
      } catch (retryError) {
        error = retryError
      }
    }

    let dbRetryError = error as DuplicateLikeError
    if (isStaffUserIdDuplicateError(dbRetryError)) {
      payload = { ...payload, user_id: null }
      try {
        await deps.insertStaff({ storeId, payload })
        return
      } catch (retryError) {
        error = retryError
        dbRetryError = retryError as DuplicateLikeError
      }
    }

    if (isStaffEmailDuplicateError(dbRetryError) || isStaffUserIdDuplicateError(dbRetryError)) {
      payload = { ...payload, user_id: null, email: null }
      await deps.insertStaff({ storeId, payload })
      return
    }

    throw error
  }
}

export async function acceptStoreInviteCore(params: {
  token: string
  user: StoreInviteAcceptUser
  nowIso: string
  deps: StoreInviteAcceptDeps
}) {
  const { token, user, deps, nowIso } = params
  if (!token) {
    throw new StoreInviteAcceptServiceError('招待トークンが必要です。')
  }

  const email = user.email?.toLowerCase() ?? ''
  if (!email) {
    throw new StoreInviteAcceptServiceError('ログインユーザーのメールが取得できません。')
  }

  const invite = await deps.fetchInviteByToken(token)
  if (!invite) {
    throw new StoreInviteAcceptServiceError('招待が見つかりません。', 404)
  }
  if (invite.used_at) {
    throw new StoreInviteAcceptServiceError('この招待はすでに使用済みです。')
  }
  if (invite.expires_at < nowIso) {
    throw new StoreInviteAcceptServiceError('この招待は有効期限切れです。')
  }
  if (invite.email.toLowerCase() !== email) {
    throw new StoreInviteAcceptServiceError('招待メールアドレスとログインユーザーが一致しません。', 403)
  }

  await deps.upsertMembership({
    storeId: invite.store_id,
    userId: user.id,
    role: invite.role,
  })

  await syncStaffRecord({
    deps,
    storeId: invite.store_id,
    user,
    email,
    role: invite.role,
  })

  await deps.consumeInvite({
    inviteId: invite.id,
    usedAt: nowIso,
    usedBy: user.id,
  })

  return {
    message: '招待を受け付けました。店舗に参加しました。',
    storeId: invite.store_id,
  }
}
