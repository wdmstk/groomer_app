import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock, requireStoreFeatureAccessMock } = vi.hoisted(() => {
  return {
    createStoreScopedClientMock: vi.fn(),
    requireStoreFeatureAccessMock: vi.fn(),
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

vi.mock('@/lib/supabase/store', () => {
  return {
    createStoreScopedClient: createStoreScopedClientMock,
  }
})

vi.mock('@/lib/feature-access', () => {
  return {
    requireStoreFeatureAccess: requireStoreFeatureAccessMock,
  }
})

describe('dashboard kpi pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = ''
  })

  it('shows access warning on appointments-kpi page when feature access is denied', async () => {
    createStoreScopedClientMock.mockResolvedValue({ supabase: {}, storeId: 'store-1' })
    requireStoreFeatureAccessMock.mockResolvedValue({ ok: false, message: 'Proプラン以上で利用できます。' })
    vi.resetModules()
    const { default: DashboardAppointmentsKpiPage } = await import(
      '../src/app/dashboard/appointments-kpi/page'
    )

    render(await DashboardAppointmentsKpiPage())

    expect(screen.getByRole('heading', { level: 1, name: 'KPIレポート' })).toBeTruthy()
    expect(screen.getByText('Proプラン以上で利用できます。')).toBeTruthy()
  })

  it('renders appointments-kpi metrics in e2e mode', async () => {
    process.env.PLAYWRIGHT_E2E = '1'
    vi.resetModules()
    const { default: DashboardAppointmentsKpiPage } = await import(
      '../src/app/dashboard/appointments-kpi/page'
    )

    render(await DashboardAppointmentsKpiPage())

    expect(screen.getByText('直近30日集計（新規優先）')).toBeTruthy()
    expect(screen.getByText('12 件')).toBeTruthy()
    expect(screen.getByText('3分20秒')).toBeTruthy()
    expect(screen.getByText('11.9')).toBeTruthy()
    expect(screen.getByText('9.1')).toBeTruthy()
    expect(screen.getByText('68%')).toBeTruthy()

    expect(screen.getByText('所要時間自動化KPI（直近500予約）')).toBeTruthy()
    expect(screen.getByText('5 件（キャンセル除外）')).toBeTruthy()
    expect(screen.getByText('8.5 分')).toBeTruthy()
    expect(screen.getByText('±10分以内: 80%')).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText('7 件/日')).toBeTruthy()

    expect(screen.getByText('再来店運用KPI（直近500予約）')).toBeTruthy()
    expect(screen.getByText('5 件')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getByText('2 件')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
  })
})
