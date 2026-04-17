import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttendancePunchActionPanel } from '../src/components/attendance/AttendancePunchActionPanel'

describe('AttendancePunchActionPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('enables only clock-in button for untouched day when location is optional', () => {
    render(
      <AttendancePunchActionPanel
        staffId="staff-1"
        redirectTo="/attendance-punch?staff_id=staff-1"
        businessDate="2026-04-17"
        locationRequired={false}
        events={[]}
      />, 
    )

    const clockIn = screen.getByRole('button', { name: /出勤打刻/ })
    const clockOut = screen.getByRole('button', { name: /退勤打刻/ })
    const breakStart = screen.getByRole('button', { name: /休憩開始/ })
    const breakEnd = screen.getByRole('button', { name: /休憩終了/ })

    expect((clockIn as HTMLButtonElement).disabled).toBe(false)
    expect((clockOut as HTMLButtonElement).disabled).toBe(true)
    expect((breakStart as HTMLButtonElement).disabled).toBe(true)
    expect((breakEnd as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('現在状態: 未出勤です。')).toBeTruthy()
  })

  it('disables all punch buttons until coordinates are fetched when location is required', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition,
      },
    })

    render(
      <AttendancePunchActionPanel
        staffId="staff-1"
        redirectTo="/attendance-punch?staff_id=staff-1"
        businessDate="2026-04-17"
        locationRequired
        events={[]}
      />,
    )

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))

    expect(screen.getByText(/位置情報必須:/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /出勤打刻/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /退勤打刻/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /休憩開始/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /休憩終了/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('stores fetched coordinates in hidden fields and enables next punch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        address: { city: '千代田区' },
      }),
    })) as unknown as typeof fetch)

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (pos: GeolocationPosition) => void) => {
          success({
            coords: {
              latitude: 35.681236,
              longitude: 139.767125,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON() {
                return {}
              },
            },
            timestamp: Date.now(),
            toJSON() {
              return {}
            },
          } as GeolocationPosition)
        },
      },
    })

    render(
      <AttendancePunchActionPanel
        staffId="staff-1"
        redirectTo="/attendance-punch?staff_id=staff-1"
        businessDate="2026-04-17"
        locationRequired
        events={[]}
      />,
    )

    await waitFor(() => expect(screen.getByText(/位置情報必須: 取得済み/)).toBeTruthy())

    const clockIn = screen.getByRole('button', { name: /出勤打刻/ })
    expect((clockIn as HTMLButtonElement).disabled).toBe(false)

    const form = clockIn.closest('form')
    expect(form).toBeTruthy()

    const hiddenLat = form?.querySelector('input[name="location_lat"]') as HTMLInputElement
    const hiddenLng = form?.querySelector('input[name="location_lng"]') as HTMLInputElement
    const hiddenAcc = form?.querySelector('input[name="location_accuracy_meters"]') as HTMLInputElement

    expect(hiddenLat.value).toBe('35.681236')
    expect(hiddenLng.value).toBe('139.767125')
    expect(hiddenAcc.value).toBe('12')

    fireEvent.click(screen.getByRole('button', { name: '位置情報を取得' }))
    await waitFor(() => expect(screen.getByText(/取得位置:/)).toBeTruthy())
  })
})
