import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, resolveAttendanceFeatureStateMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
  resolveAttendanceFeatureStateMock: vi.fn(),
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/attendance/feature', () => ({
  resolveAttendanceFeatureState: resolveAttendanceFeatureStateMock,
}))

vi.mock('@/components/attendance/AttendancePunchActionPanel', () => ({
  AttendancePunchActionPanel: (props: {
    staffId: string
    businessDate: string
    locationRequired: boolean
    events: Array<{ event_type: string }>
  }) => (
    <div data-testid="punch-panel">
      staff:{props.staffId} locationRequired:{String(props.locationRequired)} events:{props.events.length}
      businessDate:{props.businessDate}
    </div>
  ),
}))

function createDbMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-owner' } } }),
    },
    from(table: string) {
      if (table === 'store_memberships') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: { role: 'owner' }, error: null }),
            }
          },
        }
      }

      if (table === 'staffs') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order: async () => ({
                data: [
                  { id: 'staff-1', full_name: '佐藤 未来', user_id: 'user-owner' },
                  { id: 'staff-2', full_name: '高橋 彩', user_id: null },
                ],
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'store_shift_settings') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              maybeSingle: async () => ({ data: { attendance_location_required: true }, error: null }),
            }
          },
        }
      }

      if (table === 'attendance_events') {
        return {
          select() {
            return {
              eq() {
                return this
              },
              order: async () => ({
                data: [{ event_type: 'clock_in', occurred_at: '2026-04-17T00:00:00.000Z' }],
                error: null,
              }),
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('attendance-punch page', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    createStoreScopedClientMock.mockResolvedValue({
      supabase: createDbMock(),
      storeId: 'store-1',
    })
    resolveAttendanceFeatureStateMock.mockResolvedValue({ enabled: true, message: null })
  })

  it('shows selectable staff buttons when no staff is selected', async () => {
    const { default: AttendancePunchPage } = await import('../src/app/attendance-punch/page')
    const element = await AttendancePunchPage({ searchParams: Promise.resolve({}) })
    render(element)

    expect(screen.getByRole('heading', { name: '勤怠打刻' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '佐藤 未来' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '高橋 彩' })).toBeTruthy()
    expect(screen.queryByTestId('punch-panel')).toBeNull()
  })

  it('renders action panel when selected staff id is valid', async () => {
    const { default: AttendancePunchPage } = await import('../src/app/attendance-punch/page')
    const element = await AttendancePunchPage({
      searchParams: Promise.resolve({ staff_id: 'staff-1' }),
    })
    render(element)

    const panel = screen.getByTestId('punch-panel')
    expect(panel.textContent).toContain('staff:staff-1')
    expect(panel.textContent).toContain('locationRequired:true')
    expect(panel.textContent).toContain('events:1')
    expect(screen.getByRole('link', { name: 'スタッフ選択に戻る' })).toBeTruthy()
  })
})
