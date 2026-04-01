export const journalPageFixtures = {
  storeId: 'store-e2e-demo',
  customers: [
    { id: 'customer-001', full_name: '山田 花子' },
    { id: 'customer-002', full_name: '佐々木 次郎' },
  ],
  pets: [
    { id: 'pet-001', name: 'こむぎ', customer_id: 'customer-001' },
    { id: 'pet-002', name: 'ひじき', customer_id: 'customer-002' },
  ],
  entries: [
    {
      id: 'journal-entry-001',
      customer_id: 'customer-001',
      status: 'published',
      body_text: 'シャンプー中も落ち着いて過ごせました。',
      visibility: 'owner',
      posted_at: '2026-03-31T08:30:00.000Z',
      created_at: '2026-03-31T08:30:00.000Z',
    },
  ],
  entryPets: [
    {
      entry_id: 'journal-entry-001',
      pet_id: 'pet-001',
    },
  ],
  media: [
    {
      entry_id: 'journal-entry-001',
      id: 'journal-media-photo-001',
      media_type: 'photo' as const,
      storage_key: 'store-e2e-demo/journal/pets/pet-001/photo-001.jpg',
    },
    {
      entry_id: 'journal-entry-001',
      id: 'journal-media-video-001',
      media_type: 'video' as const,
      storage_key: 'store-e2e-demo/journal/pets/pet-001/video-001.mp4',
    },
  ],
} as const
