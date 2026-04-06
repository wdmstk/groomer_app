import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock, resolveCurrentStoreIdMock, requireStoreFeatureAccessMock } =
  vi.hoisted(() => {
    return {
      createServerSupabaseClientMock: vi.fn(),
      resolveCurrentStoreIdMock: vi.fn(),
      requireStoreFeatureAccessMock: vi.fn(),
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

vi.mock('@/lib/supabase/server', () => {
  return {
    createServerSupabaseClient: createServerSupabaseClientMock,
  }
})

vi.mock('@/lib/supabase/store', () => {
  return {
    resolveCurrentStoreId: resolveCurrentStoreIdMock,
  }
})

vi.mock('@/lib/feature-access', () => {
  return {
    requireStoreFeatureAccess: requireStoreFeatureAccessMock,
  }
})

describe('dashboard log pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('renders notification logs list and failure summary in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: NotificationLogsPage } = await import('../src/app/dashboard/notification-logs/page')

    render(await NotificationLogsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: '通知ログ' })).toBeTruthy()
    expect(screen.getByText('総件数')).toBeTruthy()
    expect(screen.getByText('3 件')).toBeTruthy()
    expect(screen.getByText('slot_reoffer:line_blocked: 1 件')).toBeTruthy()
    expect(screen.getByText('山田 花子')).toBeTruthy()
    expect(screen.getByText('キャンセル枠のご案内')).toBeTruthy()
  })

  it('shows store-not-configured message on notification logs page when storeId is missing', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    createServerSupabaseClientMock.mockResolvedValue({})
    resolveCurrentStoreIdMock.mockResolvedValue(null)
    vi.resetModules()
    const { default: NotificationLogsPage } = await import('../src/app/dashboard/notification-logs/page')

    render(await NotificationLogsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('有効な店舗が設定されていません。')).toBeTruthy()
  })

  it('shows access warning on audit logs page when feature access is denied', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    createServerSupabaseClientMock.mockResolvedValue({})
    resolveCurrentStoreIdMock.mockResolvedValue('store-1')
    requireStoreFeatureAccessMock.mockResolvedValue({ ok: false, message: 'Proプラン以上で利用できます。' })
    vi.resetModules()
    const { default: AuditLogsPage } = await import('../src/app/dashboard/audit-logs/page')

    render(await AuditLogsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: '監査ログ' })).toBeTruthy()
    expect(screen.getByText('Proプラン以上で利用できます。')).toBeTruthy()
  })

  it('renders filtered audit logs with member portal summary in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: AuditLogsPage } = await import('../src/app/dashboard/audit-logs/page')

    render(
      await AuditLogsPage({
        searchParams: Promise.resolve({ entity_type: 'member_portal_link' }),
      }),
    )

    expect(screen.getByText('変更履歴')).toBeTruthy()
    expect(screen.getByText('1 件')).toBeTruthy()
    expect(screen.getByText('member_portal_link: 1 件')).toBeTruthy()
    expect(screen.getByText('顧客=山田 花子, expires_at=2026-03-31T15:00:00.000Z, revoke=1')).toBeTruthy()
  })
})
