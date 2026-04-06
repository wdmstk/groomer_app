import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  redirectMock,
  createStoreScopedClientMock,
  notificationSettingsMock,
  storageSettingsMock,
} = vi.hoisted(() => {
  return {
    redirectMock: vi.fn(),
    createStoreScopedClientMock: vi.fn(),
    notificationSettingsMock: vi.fn(),
    storageSettingsMock: vi.fn(),
  }
})

vi.mock('next/navigation', () => {
  return {
    redirect: redirectMock,
  }
})

vi.mock('next/link', () => {
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string
      children: ReactNode
      [key: string]: unknown
    }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/lib/supabase/store', () => {
  return {
    createStoreScopedClient: createStoreScopedClientMock,
  }
})

vi.mock('@/components/settings/pages/PublicReserveSettingsContent', () => {
  return {
    default: () => <div data-testid="public-reserve-settings">public-reserve-settings</div>,
  }
})

vi.mock('@/components/settings/pages/StoreOperationsSettingsContent', () => {
  return {
    default: () => <div data-testid="store-ops-settings">store-ops-settings</div>,
  }
})

vi.mock('@/components/settings/pages/ConsentTemplateSettingsContent', () => {
  return {
    default: () => <div data-testid="consent-template-settings">consent-template-settings</div>,
  }
})

vi.mock('@/components/settings/pages/NotificationSettingsContent', () => {
  return {
    default: ({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) => {
      notificationSettingsMock(searchParams)
      return <div data-testid="notification-settings">notification-settings</div>
    },
  }
})

vi.mock('@/components/settings/pages/StorageSettingsContent', () => {
  return {
    default: ({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) => {
      storageSettingsMock(searchParams)
      return <div data-testid="storage-settings">storage-settings</div>
    },
  }
})

vi.mock('@/components/settings/pages/SetupStoreContent', () => {
  return {
    default: () => <div data-testid="setup-store-settings">setup-store-settings</div>,
  }
})

function createSupabaseStub({
  user,
  membership,
}: {
  user: { id: string } | null
  membership: { role: 'owner' | 'admin' | 'staff' } | null
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: membership }),
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn(() => query),
  }
}

describe('settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('redirects to dashboard in e2e mode when role is staff', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: SettingsPage } = await import('../src/app/settings/page')

    render(
      await SettingsPage({
        searchParams: Promise.resolve({ e2e_role: 'staff' }),
      }),
    )

    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('renders notifications tab in e2e mode for admin role and keeps saved/error params', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: SettingsPage } = await import('../src/app/settings/page')

    render(
      await SettingsPage({
        searchParams: Promise.resolve({
          e2e_role: 'admin',
          tab: 'notifications',
          saved: '1',
          error: 'failed',
        }),
      }),
    )

    expect(screen.getByRole('heading', { level: 1, name: '店舗管理' })).toBeTruthy()
    expect(screen.getByTestId('notification-settings')).toBeTruthy()

    const passedSearchParams = notificationSettingsMock.mock.calls[0]?.[0] as
      | Promise<Record<string, string | undefined>>
      | undefined
    await expect(passedSearchParams).resolves.toEqual({ saved: '1', error: 'failed' })
  })

  it('redirects to dashboard when non-e2e user has only staff membership', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseStub({ user: { id: 'u1' }, membership: { role: 'staff' } }),
      storeId: 'store-1',
    })
    vi.resetModules()
    const { default: SettingsPage } = await import('../src/app/settings/page')

    render(await SettingsPage({ searchParams: Promise.resolve({ tab: 'store-ops' }) }))

    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('falls back to store-ops tab when tab value is invalid', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseStub({ user: { id: 'u2' }, membership: { role: 'owner' } }),
      storeId: 'store-1',
    })
    vi.resetModules()
    const { default: SettingsPage } = await import('../src/app/settings/page')

    render(await SettingsPage({ searchParams: Promise.resolve({ tab: 'unknown-tab' }) }))

    expect(screen.getByTestId('store-ops-settings')).toBeTruthy()
  })

  it('redirects legacy storage page to tab=storage and normalizes query params', async () => {
    const { default: LegacyStorageSettingsPage } = await import('../src/app/settings/storage/page')

    await LegacyStorageSettingsPage({
      searchParams: Promise.resolve({
        tab: 'ignored',
        saved: ['1', '2'],
        empty: '',
        error: 'failed',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith('/settings?saved=1&error=failed&tab=storage')
  })

  it('redirects legacy public-reserve page to tab=public-reserve', async () => {
    const { default: LegacyPublicReserveSettingsPage } = await import(
      '../src/app/settings/public-reserve/page'
    )

    await LegacyPublicReserveSettingsPage({ searchParams: Promise.resolve({ saved: '1' }) })

    expect(redirectMock).toHaveBeenCalledWith('/settings?saved=1&tab=public-reserve')
  })

  it('redirects legacy notifications page to tab=notifications', async () => {
    const { default: LegacyNotificationSettingsPage } = await import(
      '../src/app/settings/notifications/page'
    )

    await LegacyNotificationSettingsPage({ searchParams: Promise.resolve({ error: 'failed' }) })

    expect(redirectMock).toHaveBeenCalledWith('/settings?error=failed&tab=notifications')
  })

  it('redirects legacy setup-store page to tab=setup-store', async () => {
    const { default: LegacySetupStoreSettingsPage } = await import('../src/app/settings/setup-store/page')

    await LegacySetupStoreSettingsPage({ searchParams: Promise.resolve({ saved: '1' }) })

    expect(redirectMock).toHaveBeenCalledWith('/settings?saved=1&tab=setup-store')
  })
})
