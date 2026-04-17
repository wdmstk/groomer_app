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
  shiftPlans: [
    {
      id: 'shift-001',
      staff_id: 'staff-001',
      shift_date: '2026-04-15',
      start_at: '2026-04-15T00:00:00.000Z',
      end_at: '2026-04-15T09:00:00.000Z',
      planned_break_minutes: 60,
      status: 'draft',
      source_type: 'manual',
      source_appointment_id: null,
      note: null,
    },
    {
      id: 'shift-002',
      staff_id: 'staff-002',
      shift_date: '2026-04-15',
      start_at: '2026-04-15T01:00:00.000Z',
      end_at: '2026-04-15T10:00:00.000Z',
      planned_break_minutes: 60,
      status: 'published',
      source_type: 'nomination_sync',
      source_appointment_id: null,
      note: null,
    },
  ],
  shiftAlerts: [] as Array<{ id: string; alert_date: string; alert_type: string; severity: string; staff_id: string | null; message: string }>,
  attendanceSummaries: [
    {
      id: 'attendance-summary-001',
      staff_id: 'staff-001',
      business_date: '2026-04-13',
      clock_in_at: '2026-04-13T00:00:00.000Z',
      clock_out_at: '2026-04-13T09:00:00.000Z',
      break_minutes: 60,
      worked_minutes: 480,
      status: 'complete',
    },
  ],
  attendanceEvents: [
    {
      business_date: '2026-04-13',
      event_type: 'break_start',
      occurred_at: '2026-04-13T03:00:00.000Z',
    },
    {
      business_date: '2026-04-13',
      event_type: 'break_end',
      occurred_at: '2026-04-13T04:00:00.000Z',
    },
  ],
  attendanceRequests: [
    {
      id: 'attendance-request-001',
      staff_id: 'staff-001',
      business_date: '2026-04-13',
      reason: '打刻漏れ修正',
      status: 'pending',
    },
  ],
} as const
