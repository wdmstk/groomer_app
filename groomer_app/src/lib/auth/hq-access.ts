export type StoreRole = 'owner' | 'admin' | 'staff'

export type MembershipRow = {
  store_id: string
  role: StoreRole
}

export type HqCapability = 'hq_view' | 'hq_template_request' | 'hq_template_approve'

type RoleCapabilities = Record<StoreRole, Record<HqCapability, boolean>>

// Centralized policy for HQ capabilities.
// If tenant model changes (e.g. HQ-organization mapping), update this file first.
const ROLE_CAPABILITIES: RoleCapabilities = {
  owner: {
    hq_view: true,
    hq_template_request: true,
    hq_template_approve: true,
  },
  admin: {
    hq_view: true,
    hq_template_request: false,
    hq_template_approve: false,
  },
  staff: {
    hq_view: false,
    hq_template_request: false,
    hq_template_approve: false,
  },
}

export function canRoleUseHqCapability(role: StoreRole, capability: HqCapability) {
  return ROLE_CAPABILITIES[role][capability]
}

export function getStoreIdsByHqCapability(memberships: MembershipRow[], capability: HqCapability) {
  return memberships
    .filter((row) => canRoleUseHqCapability(row.role, capability))
    .map((row) => row.store_id)
}

export function getManageableRoleByStoreId(
  memberships: MembershipRow[],
  capability: HqCapability
): Map<string, StoreRole> {
  return new Map(
    memberships
      .filter((row) => canRoleUseHqCapability(row.role, capability))
      .map((row) => [row.store_id, row.role])
  )
}
