import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppointmentServiceError } from '../src/lib/appointments/services/shared'

const {
  createStoreScopedClientMock,
  createAppointmentMock,
  normalizeCreateAppointmentInputMock,
  insertAuditLogBestEffortMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  createAppointmentMock: vi.fn(),
  normalizeCreateAppointmentInputMock: vi.fn(() => ({})),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/appointments/services/create', () => ({
  createAppointment: createAppointmentMock,
  normalizeCreateAppointmentInput: normalizeCreateAppointmentInputMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createAppointmentsRouteSupabaseMock(options?: {
  listRows?: Array<Record<string, unknown>>
  createdAppointment?: Record<string, unknown> | null
}) {
  const listRows = options?.listRows ?? [{ id: 'appt-1', status: '予約済' }]
  const createdAppointment = options?.createdAppointment ?? { id: 'appt-new-1', status: '予約済' }

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table === 'appointments') {
        return {
          select(selectArg?: string) {
            if (selectArg?.includes('customers(')) {
              return {
                eq() {
                  return this
                },
                order: async () => ({ data: listRows, error: null }),
              }
            }
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: createdAppointment, error: null }),
            }
          },
        }
      }

      if (table === 'customer_followup_tasks') {
        return {
          update() {
            return {
              eq() {
                return this
              },
            }
          },
        }
      }

      if (table === 'customer_followup_events') {
        return {
          insert: async () => ({ error: null }),
        }
      }

      if (table === 'slot_reoffers') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: null, error: null }),
            }
          },
          update() {
            return {
              eq() {
                return this
              },
            }
          },
        }
      }

      if (table === 'slot_reoffer_logs') {
        return {
          insert: async () => ({ error: null }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('appointments route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAppointmentsRouteSupabaseMock(),
      storeId: 'store-1',
    })
    createAppointmentMock.mockResolvedValue({ id: 'appt-new-1', groupId: 'grp-1' })
  })

  // TRACE-103
  it('GET returns appointment list', async () => {
    const { GET } = await import('../src/app/api/appointments/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'appt-1', status: '予約済' }])
  })

  // TRACE-104
  it('POST returns JSON body when request accepts application/json', async () => {
    const { POST } = await import('../src/app/api/appointments/route')
    const formData = new FormData()
    formData.set('customer_id', 'customer-1')
    const response = await POST(
      new Request('http://localhost/api/appointments', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: formData,
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: 'appt-new-1',
      groupId: 'grp-1',
      appointment: { id: 'appt-new-1', status: '予約済' },
    })
    expect(insertAuditLogBestEffortMock).toHaveBeenCalledTimes(1)
  })

  // TRACE-105
  it('POST returns 409 with conflict payload when service reports conflict', async () => {
    createAppointmentMock.mockRejectedValue(
      new AppointmentServiceError('予約が競合しています。', 409, {
        conflict: { appointmentId: 'appt-conflict-1' },
      })
    )
    const { POST } = await import('../src/app/api/appointments/route')
    const response = await POST(
      new Request('http://localhost/api/appointments', {
        method: 'POST',
        body: new FormData(),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: '予約が競合しています。',
      conflict: { appointmentId: 'appt-conflict-1' },
    })
  })
})
