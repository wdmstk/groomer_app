import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreSwitcher } from '../src/components/ui/StoreSwitcher'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      refresh: refreshMock,
    }),
  }
})

const STORES_CACHE_KEY = 'stores_response_cache_v1'

function buildStoreResponse() {
  return {
    activeStoreId: 'store-1',
    stores: [
      {
        id: 'store-1',
        name: '渋谷店',
        role: 'owner' as const,
        planCode: 'pro',
        uiTheme: 'clean-medical' as const,
        hotelOptionEnabled: true,
        notificationOptionEnabled: false,
      },
      {
        id: 'store-2',
        name: '新宿店',
        role: 'admin' as const,
        planCode: 'light',
        uiTheme: 'cute-pop' as const,
        hotelOptionEnabled: false,
        notificationOptionEnabled: true,
      },
    ],
    user: { email: 'owner@example.com' },
  }
}

describe('StoreSwitcher component', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('renders unavailable message when single store and showUnavailableState is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeStoreId: 'store-1',
        stores: [{ id: 'store-1', name: '渋谷店', role: 'owner' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<StoreSwitcher showUnavailableState />)

    await waitFor(() => {
      expect(screen.getByText('店舗切替')).toBeTruthy()
      expect(screen.getByText('渋谷店（単一店舗のため切替なし）')).toBeTruthy()
    })
  })

  it('uses session cache instead of fetching stores', async () => {
    const cached = buildStoreResponse()
    window.sessionStorage.setItem(
      STORES_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data: cached }),
    )

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onUserEmailChange = vi.fn()

    render(<StoreSwitcher compact onUserEmailChange={onUserEmailChange} />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onUserEmailChange).toHaveBeenCalledWith('owner@example.com')
    expect(window.sessionStorage.getItem('active_store_id')).toBe('store-1')
  })

  it('posts active store change and refreshes router', async () => {
    const stores = buildStoreResponse()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => stores,
      })
      .mockResolvedValueOnce({
        ok: true,
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<StoreSwitcher compact />)

    const select = await screen.findByRole('combobox')
    fireEvent.change(select, { target: { value: 'store-2' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/stores/active')
    expect(window.sessionStorage.getItem('active_store_id')).toBe('store-2')
  })
})
