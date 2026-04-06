import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock, resolveCurrentStoreIdMock } = vi.hoisted(() => {
  return {
    createServerSupabaseClientMock: vi.fn(),
    resolveCurrentStoreIdMock: vi.fn(),
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
    Card: ({ children, className }: { children: ReactNode; className?: string }) => (
      <div data-testid="card" className={className}>
        {children}
      </div>
    ),
  }
})

vi.mock('@/components/dashboard/QuickPaymentModal', () => {
  return {
    QuickPaymentModal: () => <div data-testid="quick-payment-modal">quick-payment-modal</div>,
  }
})

vi.mock('@/components/dashboard/SlotReofferPanel', () => {
  return {
    SlotReofferPanel: () => <div data-testid="slot-reoffer-panel">slot-reoffer-panel</div>,
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

describe('dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('shows setup guidance when storeId is missing in non-e2e mode', async () => {
    createServerSupabaseClientMock.mockResolvedValue({})
    resolveCurrentStoreIdMock.mockResolvedValue(null)
    vi.resetModules()
    const { default: DashboardPage } = await import('../src/app/dashboard/page')

    render(await DashboardPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: 'ダッシュボード' })).toBeTruthy()
    expect(
      screen.getByText(
        '現在のユーザーには有効な店舗が設定されていません。`store_memberships` に所属店舗を追加してください。',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Webで店舗を作成' }).getAttribute('href')).toBe(
      '/dashboard/setup-store',
    )
  })

  it('renders overview tab in e2e mode with summary cards and followup window links', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DashboardPage } = await import('../src/app/dashboard/page')

    render(await DashboardPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('本日の予約件数')).toBeTruthy()
    expect(screen.getByText('本日売上見込み')).toBeTruthy()
    expect(screen.getByText('Today Focus')).toBeTruthy()
    expect(screen.getByText('次の一手')).toBeTruthy()
    expect(screen.getByRole('link', { name: '直近7日' }).getAttribute('href')).toBe(
      '/dashboard?followup_window=7',
    )
    expect(screen.getByRole('link', { name: '直近30日' }).getAttribute('href')).toBe(
      '/dashboard?followup_window=30',
    )
  })

  it('renders operations tab content in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DashboardPage } = await import('../src/app/dashboard/page')

    render(await DashboardPage({ searchParams: Promise.resolve({ tab: 'operations' }) }))

    expect(screen.getByText('遅延しやすい時間帯（直近30日）')).toBeTruthy()
    expect(screen.getAllByText('30分以内の予約').length).toBeGreaterThan(0)
    expect(screen.getByText('未会計アラート（本日）')).toBeTruthy()
    expect(screen.getAllByTestId('quick-payment-modal').length).toBeGreaterThan(0)
  })

  it('renders followups tab content in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DashboardPage } = await import('../src/app/dashboard/page')

    render(await DashboardPage({ searchParams: Promise.resolve({ tab: 'followups', followup_window: '30' }) }))

    expect(screen.getByText('離脱予兆の優先対応リスト')).toBeTruthy()
    expect(screen.getByText('再来店フォロー隊列')).toBeTruthy()
    expect(screen.getByText('担当者別フォローKPI')).toBeTruthy()
    expect(screen.getByRole('link', { name: '直近30日' }).getAttribute('href')).toContain(
      'tab=followups&followup_window=30',
    )
  })

  it('renders reoffers tab content in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DashboardPage } = await import('../src/app/dashboard/page')

    render(await DashboardPage({ searchParams: Promise.resolve({ tab: 'reoffers' }) }))

    expect(screen.getByText('空き枠提示型の運用ステータス')).toBeTruthy()
    expect(screen.getByText('公開予約受付（本日）')).toBeTruthy()
    expect(screen.getByText('担当者別 再販KPI')).toBeTruthy()
    expect(screen.getByTestId('slot-reoffer-panel')).toBeTruthy()
  })
})
