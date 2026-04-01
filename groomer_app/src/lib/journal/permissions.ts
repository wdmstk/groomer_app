export type JournalPermissions = {
  canCreate: boolean
  canPublish: boolean
  canViewInternal: boolean
  canDelete: boolean
}

type PermissionParams = {
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  }
  storeId: string
  role: string
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase()
}

function defaultPermissionsByRole(role: string): JournalPermissions {
  const normalized = normalizeRole(role)
  if (normalized === 'owner' || normalized === 'admin') {
    return {
      canCreate: true,
      canPublish: true,
      canViewInternal: true,
      canDelete: true,
    }
  }

  if (normalized === 'staff') {
    return {
      canCreate: true,
      canPublish: false,
      canViewInternal: false,
      canDelete: false,
    }
  }

  return {
    canCreate: false,
    canPublish: false,
    canViewInternal: false,
    canDelete: false,
  }
}

export async function resolveJournalPermissions(params: PermissionParams): Promise<JournalPermissions> {
  const defaults = defaultPermissionsByRole(params.role)

  const { data, error } = await params.supabase
    .from('journal_permissions_override')
    .select('can_create, can_publish, can_view_internal, can_delete')
    .eq('store_id', params.storeId)
    .eq('role', normalizeRole(params.role))
    .maybeSingle()

  if (error || !data || typeof data !== 'object' || data === null) {
    return defaults
  }

  const row = data as {
    can_create?: boolean | null
    can_publish?: boolean | null
    can_view_internal?: boolean | null
    can_delete?: boolean | null
  }

  return {
    canCreate: row.can_create ?? defaults.canCreate,
    canPublish: row.can_publish ?? defaults.canPublish,
    canViewInternal: row.can_view_internal ?? defaults.canViewInternal,
    canDelete: row.can_delete ?? defaults.canDelete,
  }
}

export function requireJournalPermission(
  permissions: JournalPermissions,
  key: keyof JournalPermissions
): { ok: true } | { ok: false; status: number; message: string } {
  if (permissions[key]) return { ok: true }
  return {
    ok: false,
    status: 403,
    message: 'この操作を実行する権限がありません。',
  }
}
