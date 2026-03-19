export function getStaffMembershipLabel(params: {
  userId: string | null
  canManageRoles: boolean
  roleByUserId: Map<string, string>
}) {
  if (!params.userId) return '未連携'
  const role = params.roleByUserId.get(params.userId)
  if (role) return role
  return params.canManageRoles ? '未所属' : '非表示'
}

export function canCreateMoreStaff(params: { isLightPlan: boolean; staffCount: number }) {
  return !params.isLightPlan || params.staffCount < 3
}

export function formatInviteExpiresAt(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
