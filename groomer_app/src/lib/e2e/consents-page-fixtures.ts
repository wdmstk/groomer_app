export const consentsPageFixtures = {
  storeId: 'store-e2e-demo',
  templates: [
    {
      id: 'tpl-001',
      name: '施術前同意書',
      category: 'grooming',
      status: 'published',
      current_version_id: 'ver-001',
    },
  ],
  customers: [
    { id: 'customer-001', full_name: '山田 花子' },
    { id: 'customer-002', full_name: '佐々木 次郎' },
  ],
  pets: [
    { id: 'pet-001', customer_id: 'customer-001', name: 'こむぎ' },
    { id: 'pet-002', customer_id: 'customer-002', name: 'ひじき' },
  ],
  documents: [
    {
      id: 'consent-doc-001',
      customer_id: 'customer-001',
      pet_id: 'pet-001',
      appointment_id: 'appt-001',
      status: 'draft',
      signed_at: null,
      created_at: '2026-03-26T08:00:00.000Z',
      pdf_path: null,
    },
  ],
} as const
