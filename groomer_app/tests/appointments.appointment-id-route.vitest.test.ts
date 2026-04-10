import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppointmentServiceError } from '../src/lib/appointments/services/shared'

const {
  createStoreScopedClientMock,
  normalizeUpdateAppointmentJsonInputMock,
  normalizeUpdateAppointmentFormInputMock,
  updateAppointmentMock,
  deleteAppointmentMock,
  insertAuditLogBestEffortMock,
} = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  normalizeUpdateAppointmentJsonInputMock: vi.fn((value) => value),
  normalizeUpdateAppointmentFormInputMock: vi.fn(() => ({})),
  updateAppointmentMock: vi.fn(),
  deleteAppointmentMock: vi.fn(),
  insertAuditLogBestEffortMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/appointments/services/update', () => ({
  normalizeUpdateAppointmentJsonInput: normalizeUpdateAppointmentJsonInputMock,
  normalizeUpdateAppointmentFormInput: normalizeUpdateAppointmentFormInputMock,
  updateAppointment: updateAppointmentMock,
}))

vi.mock('@/lib/appointments/services/delete', () => ({
  deleteAppointment: deleteAppointmentMock,
}))

vi.mock('@/lib/audit-logs', () => ({
  insertAuditLogBestEffort: insertAuditLogBestEffortMock,
}))

function createAppointmentIdRouteSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from(table: string) {
      if (table !== 'appointments') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select() {
          return {
            eq() {
              return this
            },
            maybeSingle: async () => ({
              data: {
                id: 'appt-1',
                customer_id: 'customer-1',
                status: '予約済',
              },
              error: null,
            }),
            single: async () => ({
              data: { id: 'appt-1', status: '予約済' },
              error: null,
            }),
          }
        },
      }
    },
  }
}

function buildParams(appointmentId = 'appt-1') {
  return { params: Promise.resolve({ appointment_id: appointmentId }) }
}

describe('appointments/[appointment_id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createAppointmentIdRouteSupabaseMock(),
      storeId: 'store-1',
    })
    deleteAppointmentMock.mockResolvedValue({ success: true })
    updateAppointmentMock.mockResolvedValue({ id: 'appt-1', status: '受付' })
  })

  // TRACE-106
  it('POST with _method=delete deletes appointment and redirects to list tab', async () => {
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/route')
    const formData = new FormData()
    formData.set('_method', 'delete')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/appointments?tab=list')
    expect(deleteAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        appointmentId: 'appt-1',
      })
    )
  })

  // TRACE-107
  it('POST returns 405 for unsupported _method', async () => {
    const { POST } = await import('../src/app/api/appointments/[appointment_id]/route')
    const formData = new FormData()
    formData.set('_method', 'unknown')
    const response = await POST(
      new Request('http://localhost/api/appointments/appt-1', {
        method: 'POST',
        body: formData,
      }),
      buildParams()
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported method' })
  })

  // TRACE-108
  it('PUT returns service error status/message when update fails validation', async () => {
    updateAppointmentMock.mockRejectedValue(new AppointmentServiceError('予約開始日時は必須です。', 400))
    const { PUT } = await import('../src/app/api/appointments/[appointment_id]/route')
    const response = await PUT(
      new Request('http://localhost/api/appointments/appt-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start_time: '' }),
      }),
      buildParams()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ message: '予約開始日時は必須です。' })
  })
})
