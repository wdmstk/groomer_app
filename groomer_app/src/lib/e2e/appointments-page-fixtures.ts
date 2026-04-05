type AppointmentFixture = {
  id: string
  customer_id: string | null
  pet_id: string | null
  staff_id: string | null
  start_time: string | null
  end_time: string | null
  menu: string | null
  duration: number | null
  status: string | null
  notes: string | null
  checked_in_at?: string | null
  in_service_at?: string | null
  payment_waiting_at?: string | null
  completed_at?: string | null
  reservation_payment_method?: string | null
  reservation_payment_status?: string | null
  customers: { full_name: string }[] | null
  pets: { name: string }[] | null
  staffs: { full_name: string }[] | null
}

export const appointmentsPageFixtures = {
  storeId: 'store-e2e-demo',
  appointments: [
    {
      id: 'appt-pending-001',
      customer_id: 'customer-001',
      pet_id: 'pet-001',
      staff_id: 'staff-001',
      start_time: '2026-03-15T01:00:00.000Z',
      end_time: '2026-03-15T03:00:00.000Z',
      menu: 'トリミング+歯磨き',
      duration: 120,
      status: '予約申請',
      notes: '噛み癖あり。口周りは短時間で。',
      reservation_payment_method: 'none',
      reservation_payment_status: 'unpaid',
      customers: [{ full_name: '山田 花子' }],
      pets: [{ name: 'モカ' }],
      staffs: [{ full_name: '佐藤 未来' }],
    },
    {
      id: 'appt-booked-002',
      customer_id: 'customer-002',
      pet_id: 'pet-002',
      staff_id: 'staff-002',
      start_time: '2026-03-16T00:30:00.000Z',
      end_time: '2026-03-16T02:00:00.000Z',
      menu: 'お手入れセット',
      duration: 90,
      status: '予約済',
      notes: null,
      reservation_payment_method: 'prepayment',
      reservation_payment_status: 'paid',
      customers: [{ full_name: '鈴木 一郎' }],
      pets: [{ name: 'レオ' }],
      staffs: [{ full_name: '高橋 彩' }],
    },
    {
      id: 'appt-completed-003',
      customer_id: 'customer-003',
      pet_id: 'pet-003',
      staff_id: 'staff-001',
      start_time: '2026-02-01T01:30:00.000Z',
      end_time: '2026-02-01T03:30:00.000Z',
      menu: 'シャンプーコース',
      duration: 120,
      status: '完了',
      notes: '多頭飼い。次回は兄弟犬も同日希望。',
      reservation_payment_method: 'none',
      reservation_payment_status: 'unpaid',
      completed_at: '2026-02-01T03:35:00.000Z',
      customers: [{ full_name: '田中 恵' }],
      pets: [{ name: 'こむぎ' }],
      staffs: [{ full_name: '佐藤 未来' }],
    },
    {
      id: 'appt-fallback-004',
      customer_id: null,
      pet_id: null,
      staff_id: null,
      start_time: null,
      end_time: null,
      menu: '猫お手入れ',
      duration: 45,
      status: '会計待ち',
      notes: null,
      reservation_payment_method: 'none',
      reservation_payment_status: 'unpaid',
      payment_waiting_at: '2026-03-16T05:15:00.000Z',
      customers: null,
      pets: null,
      staffs: null,
    },
  ] satisfies AppointmentFixture[],
  customers: [
    { id: 'customer-001', full_name: '山田 花子' },
    { id: 'customer-002', full_name: '鈴木 一郎' },
    { id: 'customer-003', full_name: '田中 恵' },
  ],
  pets: [
    { id: 'pet-001', name: 'モカ', customer_id: 'customer-001' },
    { id: 'pet-002', name: 'レオ', customer_id: 'customer-002' },
    { id: 'pet-003', name: 'こむぎ', customer_id: 'customer-003' },
    { id: 'pet-004', name: 'ひじき', customer_id: 'customer-003' },
  ],
  staffs: [
    { id: 'staff-001', full_name: '佐藤 未来' },
    { id: 'staff-002', full_name: '高橋 彩' },
  ],
  serviceMenus: [
    {
      id: 'menu-001',
      name: 'トリミング',
      price: 8500,
      duration: 120,
      tax_rate: 10,
      tax_included: true,
      is_active: true,
    },
    {
      id: 'menu-002',
      name: '歯磨き',
      price: 800,
      duration: 15,
      tax_rate: 10,
      tax_included: true,
      is_active: true,
    },
    {
      id: 'menu-003',
      name: '毛玉取り',
      price: 1200,
      duration: 20,
      tax_rate: 10,
      tax_included: true,
      is_active: true,
    },
  ],
  appointmentMenus: [
    { appointment_id: 'appt-pending-001', menu_id: 'menu-001' },
    { appointment_id: 'appt-pending-001', menu_id: 'menu-002' },
    { appointment_id: 'appt-booked-002', menu_id: 'menu-003' },
    { appointment_id: 'appt-completed-003', menu_id: 'menu-001' },
  ],
  consents: [
    {
      id: 'consent-appt-002',
      appointment_id: 'appt-booked-002',
      status: 'draft',
      pdf_path: null,
      created_at: '2026-03-16T00:40:00.000Z',
    },
    {
      id: 'consent-appt-003',
      appointment_id: 'appt-completed-003',
      status: 'signed',
      pdf_path: 'store-e2e-demo/consent-appt-003.pdf',
      created_at: '2026-02-01T03:40:00.000Z',
    },
  ],
} as const
