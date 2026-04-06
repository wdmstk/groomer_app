import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/public-reservations/presentation', () => ({
  buildPublicSubmittedReservationSummary: vi.fn(() => []),
  formatPublicSlotLabel: vi.fn(() => 'slot-label'),
  formatPublicSlotTime: vi.fn(() => 'slot-time'),
  getPublicSlotMessage: vi.fn(() => ''),
  toPublicJstDatetimeLocalValue: vi.fn(() => ''),
}))

describe('reserve form client', () => {
  it('renders reserve form and loads store meta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          store: { id: 'store-1', name: '店舗A' },
          menus: [],
          instant_menu_ids: [],
        }),
      }),
    )

    const { ReserveForm } = await import('../src/app/reserve/[store_id]/reserve-form')

    render(<ReserveForm storeId="store-1" />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '予約申請フォーム' })).toBeTruthy()
      expect(screen.getByText(/店舗: 店舗A/)).toBeTruthy()
    })
  })
})
