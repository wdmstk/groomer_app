import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { notFoundMock, redirectMock, requireDeveloperAdminMock } = vi.hoisted(() => {
  return {
    notFoundMock: vi.fn(),
    redirectMock: vi.fn(),
    requireDeveloperAdminMock: vi.fn(),
  }
})

vi.mock('next/navigation', () => {
  return {
    notFound: notFoundMock,
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

vi.mock('@/components/billing/PaymentMethodButtons', () => {
  return {
    PaymentMethodButtons: () => <div data-testid="payment-method-buttons">payment-method-buttons</div>,
  }
})

vi.mock('@/components/member-portal/MemberPortalWaitlistCard', () => {
  return {
    MemberPortalWaitlistCard: ({ token }: { token: string }) => (
      <div data-testid="waitlist-card">waitlist:{token}</div>
    ),
  }
})

vi.mock('@/components/member-portal/MemberPortalReissueRequestButton', () => {
  return {
    MemberPortalReissueRequestButton: ({ token }: { token: string }) => (
      <button type="button">reissue:{token}</button>
    ),
  }
})

vi.mock('@/components/support/DeveloperSupportChat', () => {
  return {
    DeveloperSupportChat: () => <div data-testid="developer-support-chat">developer-support-chat</div>,
  }
})

vi.mock('@/lib/auth/developer-admin', () => {
  return {
    requireDeveloperAdmin: requireDeveloperAdminMock,
  }
})

describe('misc app pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('renders billing-required page with payment buttons and logout link', async () => {
    const { default: BillingRequiredPage } = await import('../src/app/billing-required/page')

    render(<BillingRequiredPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'お支払い設定が必要です' })).toBeTruthy()
    expect(screen.getByTestId('payment-method-buttons')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ログアウト' }).getAttribute('href')).toBe('/logout')
  })

  it('calls notFound on member-portal-waitlist-e2e page when e2e mode is disabled', async () => {
    const { default: Page } = await import('../src/app/member-portal-waitlist-e2e/page')

    render(<Page />)
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('renders member-portal-waitlist card when e2e mode is enabled', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    const { default: Page } = await import('../src/app/member-portal-waitlist-e2e/page')

    render(<Page />)

    expect(screen.getByTestId('waitlist-card').textContent).toContain('waitlist:e2e-token')
  })

  it('calls notFound on member-portal-reissue-e2e page when e2e mode is disabled', async () => {
    const { default: Page } = await import('../src/app/member-portal-reissue-e2e/page')

    render(<Page />)
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('renders reissue button when e2e mode is enabled', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    const { default: Page } = await import('../src/app/member-portal-reissue-e2e/page')

    render(<Page />)

    expect(screen.getByRole('button', { name: 'reissue:e2e-token' })).toBeTruthy()
  })

  it('renders dev page access denied message when auth is not ok', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: false })
    const { default: DevHomePage } = await import('../src/app/dev/page')

    render(await DevHomePage())

    expect(screen.getByText('このページはサポート管理者のみアクセスできます。')).toBeTruthy()
  })

  it('renders dev page cards when auth is ok', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })
    const { default: DevHomePage } = await import('../src/app/dev/page')

    render(await DevHomePage())

    expect(screen.getByRole('heading', { level: 1, name: '開発者管理ページ一覧' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '開く' }).length).toBeGreaterThan(0)
  })

  it('redirects dev support chat page when e2e mode is disabled', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: DevSupportChatPage } = await import('../src/app/dev/support-chat/page')

    await DevSupportChatPage()

    expect(redirectMock).toHaveBeenCalledWith('/dev/support-tickets')
  })

  it('renders developer support chat when e2e mode is enabled', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DevSupportChatPage } = await import('../src/app/dev/support-chat/page')

    render(await DevSupportChatPage())

    expect(screen.getByTestId('developer-support-chat')).toBeTruthy()
  })
})
