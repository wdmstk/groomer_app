export const customersPageFixtures = {
  storeId: 'store-e2e-demo',
  customers: [
    {
      id: 'customer-001',
      full_name: '山田 花子',
      phone_number: '090-1111-2222',
      email: 'hanako@example.com',
      address: '東京都世田谷区1-2-3',
      line_id: 'line-user-123',
      how_to_know: 'Instagram',
      tags: ['多頭飼い', '噛み癖'],
    },
    {
      id: 'customer-002',
      full_name: '佐々木 次郎',
      phone_number: null,
      email: '',
      address: null,
      line_id: null,
      how_to_know: null,
      tags: null,
    },
  ],
  appointments: [
    { customer_id: 'customer-001' },
    { customer_id: 'customer-001' },
  ],
  memberPortalLinks: [
    {
      id: 'portal-001',
      customer_id: 'customer-001',
      expires_at: '2026-06-01T03:00:00.000Z',
      last_used_at: '2026-03-14T07:30:00.000Z',
    },
  ],
} as const
