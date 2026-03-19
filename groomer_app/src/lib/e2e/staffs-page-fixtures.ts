export const staffsPageFixtures = {
  storeId: 'store-e2e-demo',
  isLightPlan: true,
  canManageRoles: false,
  staffs: [
    {
      id: 'staff-001',
      full_name: '佐藤 未来',
      email: 'miku@example.com',
      user_id: 'user-001',
    },
    {
      id: 'staff-002',
      full_name: '高橋 彩',
      email: null,
      user_id: null,
    },
    {
      id: 'staff-003',
      full_name: '伊藤 健',
      email: 'ken@example.com',
      user_id: 'user-003',
    },
  ],
  memberships: [
    { id: 'membership-001', user_id: 'user-001', role: 'owner' },
  ],
} as const
