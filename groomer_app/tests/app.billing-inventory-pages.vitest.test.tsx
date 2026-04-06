import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, billingManagementContentMock } = vi.hoisted(() => {
  return {
    redirectMock: vi.fn(),
    billingManagementContentMock: vi.fn(),
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

vi.mock('@/components/ui/Card', () => {
  return {
    Card: ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>,
  }
})

vi.mock('@/components/billing/pages/BillingManagementContent', () => {
  return {
    default: ({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) => {
      billingManagementContentMock(searchParams)
      return <div data-testid="billing-management-content">billing-management-content</div>
    },
  }
})

vi.mock('@/components/billing/pages/BillingHistoryContent', () => {
  return {
    default: () => <div data-testid="billing-history-content">billing-history-content</div>,
  }
})

describe('billing and inventory pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('renders billing management tab by default and forwards message/error params', async () => {
    const { default: BillingPage } = await import('../src/app/billing/page')

    render(
      await BillingPage({
        searchParams: Promise.resolve({ message: 'ok', error: 'none' }),
      }),
    )

    expect(screen.getByRole('heading', { level: 1, name: '決済管理' })).toBeTruthy()
    expect(screen.getByTestId('billing-management-content')).toBeTruthy()

    const passedSearchParams = billingManagementContentMock.mock.calls[0]?.[0] as
      | Promise<Record<string, string | undefined>>
      | undefined
    await expect(passedSearchParams).resolves.toEqual({ message: 'ok', error: 'none' })
  })

  it('renders billing history tab when tab=history is provided', async () => {
    const { default: BillingPage } = await import('../src/app/billing/page')

    render(await BillingPage({ searchParams: Promise.resolve({ tab: 'history' }) }))

    expect(screen.getByTestId('billing-history-content')).toBeTruthy()
    expect(screen.queryByTestId('billing-management-content')).toBeNull()
  })

  it('falls back to management tab for unknown tab', async () => {
    const { default: BillingPage } = await import('../src/app/billing/page')

    render(await BillingPage({ searchParams: Promise.resolve({ tab: 'unknown-tab' }) }))

    expect(screen.getByTestId('billing-management-content')).toBeTruthy()
  })

  it('redirects legacy billing history page to tab=history with normalized query params', async () => {
    const { default: LegacyBillingHistoryPage } = await import('../src/app/billing/history/page')

    await LegacyBillingHistoryPage({
      searchParams: Promise.resolve({
        tab: 'ignored',
        message: ['saved', 'ignored'],
        empty: '',
        error: 'failed',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith('/billing?message=saved&error=failed&tab=history')
  })

  it('renders inventory dashboard metrics from e2e fixtures', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: InventoryDashboardPage } = await import('../src/app/inventory/page')

    render(await InventoryDashboardPage())

    expect(screen.getByRole('heading', { level: 1, name: '在庫ダッシュボード' })).toBeTruthy()
    expect(screen.getByText('不足商品')).toBeTruthy()
    expect(screen.getByText('3 件')).toBeTruthy()
    expect(screen.getByText('期限切れ間近（14日）')).toBeTruthy()
    expect(screen.getByText('2 件')).toBeTruthy()
    expect(screen.getByText('トリートメント剤')).toBeTruthy()
    expect(screen.getByText('デンタルガム')).toBeTruthy()
  })

  it('redirects dashboard setup-store legacy page to settings setup-store tab', async () => {
    const { default: LegacyDashboardSetupStorePage } = await import('../src/app/dashboard/setup-store/page')

    await LegacyDashboardSetupStorePage({
      searchParams: Promise.resolve({
        tab: 'ignored',
        saved: ['1', '2'],
        error: 'failed',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith('/settings?saved=1&error=failed&tab=setup-store')
  })
})
