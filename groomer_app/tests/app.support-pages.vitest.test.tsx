import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, requireStoreSupportTicketAccessMock, requireDeveloperAdminMock } = vi.hoisted(() => {
  return {
    redirectMock: vi.fn(),
    requireStoreSupportTicketAccessMock: vi.fn(),
    requireDeveloperAdminMock: vi.fn(),
  }
})

vi.mock('next/navigation', () => {
  return {
    redirect: redirectMock,
  }
})

vi.mock('next/dynamic', () => {
  return {
    default: () => {
      return function MockDynamicComponent() {
        return <div data-testid="owner-support-tickets-dynamic">owner-support-tickets-dynamic</div>
      }
    },
  }
})

vi.mock('@/lib/auth/store-support-ticket', () => {
  return {
    requireStoreSupportTicketAccess: requireStoreSupportTicketAccessMock,
  }
})

vi.mock('@/lib/auth/developer-admin', () => {
  return {
    requireDeveloperAdmin: requireDeveloperAdminMock,
  }
})

vi.mock('@/components/support/OwnerSupportChat', () => {
  return {
    OwnerSupportChat: () => <div data-testid="owner-support-chat">owner-support-chat</div>,
  }
})

vi.mock('@/components/support/DeveloperSupportTickets', () => {
  return {
    DeveloperSupportTickets: () => <div data-testid="developer-support-tickets">developer-support-tickets</div>,
  }
})

describe('support pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('redirects /support-chat to /support-tickets when e2e mode is disabled', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: SupportChatPage } = await import('../src/app/support-chat/page')

    await SupportChatPage()

    expect(redirectMock).toHaveBeenCalledWith('/support-tickets')
  })

  it('renders owner support chat on /support-chat when e2e mode is enabled', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: SupportChatPage } = await import('../src/app/support-chat/page')

    render(await SupportChatPage())

    expect(screen.getByTestId('owner-support-chat')).toBeTruthy()
  })

  it('renders access denied message on /support-tickets when auth fails', async () => {
    requireStoreSupportTicketAccessMock.mockResolvedValue({
      ok: false,
      message: '店舗メンバーのみ利用できます。',
    })
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: SupportTicketsPage } = await import('../src/app/support-tickets/page')

    render(await SupportTicketsPage())

    expect(screen.getByRole('heading', { level: 1, name: '問い合わせチケット' })).toBeTruthy()
    expect(screen.getByText('店舗メンバーのみ利用できます。')).toBeTruthy()
  })

  it('renders owner support tickets on /support-tickets when auth is ok', async () => {
    requireStoreSupportTicketAccessMock.mockResolvedValue({ ok: true })
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: SupportTicketsPage } = await import('../src/app/support-tickets/page')

    render(await SupportTicketsPage())

    expect(screen.getByTestId('owner-support-tickets-dynamic')).toBeTruthy()
  })

  it('bypasses auth and renders owner support tickets in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: SupportTicketsPage } = await import('../src/app/support-tickets/page')

    render(await SupportTicketsPage())

    expect(screen.getByTestId('owner-support-tickets-dynamic')).toBeTruthy()
    expect(requireStoreSupportTicketAccessMock).not.toHaveBeenCalled()
  })

  it('renders access denied message on /dev/support-tickets when auth fails', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: false })
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: DevSupportTicketsPage } = await import('../src/app/dev/support-tickets/page')

    render(await DevSupportTicketsPage())

    expect(screen.getByRole('heading', { level: 1, name: 'サポートチケット（開発者）' })).toBeTruthy()
    expect(screen.getByText('このページはサポート管理者のみアクセスできます。')).toBeTruthy()
  })

  it('renders developer support tickets on /dev/support-tickets when auth is ok', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: DevSupportTicketsPage } = await import('../src/app/dev/support-tickets/page')

    render(await DevSupportTicketsPage())

    expect(screen.getByTestId('developer-support-tickets')).toBeTruthy()
  })

  it('bypasses auth and renders developer support tickets in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DevSupportTicketsPage } = await import('../src/app/dev/support-tickets/page')

    render(await DevSupportTicketsPage())

    expect(screen.getByTestId('developer-support-tickets')).toBeTruthy()
    expect(requireDeveloperAdminMock).not.toHaveBeenCalled()
  })
})
