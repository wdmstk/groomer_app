import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, requireDeveloperAdminMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  requireDeveloperAdminMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt = '', ...props }: { alt?: string; [k: string]: unknown }) => <img alt={alt} {...props} />,
}))

vi.mock('next/dynamic', () => ({
  default: () => {
    return function DynamicStub() {
      return <div data-testid="dynamic-stub">dynamic-stub</div>
    }
  },
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>,
}))
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}))
vi.mock('@/components/ui/Input', () => ({
  Input: (props: { [k: string]: unknown }) => <input {...props} />,
}))
vi.mock('@/components/ui/FormModal', () => ({
  FormModal: ({ children }: { children: ReactNode }) => <div data-testid="form-modal">{children}</div>,
}))

vi.mock('@/components/appointments/AppointmentCalendar', () => ({
  AppointmentCalendar: () => <div data-testid="appointment-calendar">appointment-calendar</div>,
}))
vi.mock('@/components/appointments/AppointmentCreateModal', () => ({
  AppointmentCreateModal: () => <div data-testid="appointment-create-modal">appointment-create-modal</div>,
}))
vi.mock('@/components/consents/ConsentManagementPanel', () => ({
  ConsentManagementPanel: () => <div data-testid="consent-management-panel">consent-management-panel</div>,
}))
vi.mock('@/components/customers/CustomerMemberPortalControls', () => ({
  CustomerMemberPortalControls: () => <div data-testid="customer-member-portal-controls">controls</div>,
}))
vi.mock('@/components/journal/JournalComposer', () => ({
  default: () => <div data-testid="journal-composer">journal-composer</div>,
}))
vi.mock('@/components/ops/OpsStatusActionForm', () => ({
  OpsStatusActionForm: () => <div data-testid="ops-status-action-form">ops-status-action-form</div>,
}))
vi.mock('@/components/ops/OpsRevertStatusForm', () => ({
  OpsRevertStatusForm: () => <div data-testid="ops-revert-status-form">ops-revert-status-form</div>,
}))
vi.mock('@/components/payments/PaymentCreateModal', () => ({
  PaymentCreateModal: () => <div data-testid="payment-create-modal">payment-create-modal</div>,
}))
vi.mock('@/components/payments/InvoiceCheckoutPanel', () => ({
  InvoiceCheckoutPanel: () => <div data-testid="invoice-checkout-panel">invoice-checkout-panel</div>,
}))
vi.mock('@/components/payments/PosCheckoutPanel', () => ({
  PosCheckoutPanel: () => <div data-testid="pos-checkout-panel">pos-checkout-panel</div>,
}))
vi.mock('@/components/pets/PetCreateModal', () => ({
  PetCreateModal: () => <div data-testid="pet-create-modal">pet-create-modal</div>,
}))
vi.mock('@/components/receipts/PrintButton', () => ({
  PrintButton: () => <button type="button">print</button>,
}))
vi.mock('@/components/receipts/PosVoidAction', () => ({
  PosVoidAction: () => <button type="button">void</button>,
}))
vi.mock('@/components/staffs/InviteManager', () => ({
  InviteManager: () => <div data-testid="invite-manager">invite-manager</div>,
}))
vi.mock('@/lib/auth/developer-admin', () => ({
  requireDeveloperAdmin: requireDeveloperAdminMock,
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}))

describe('remaining fixture-friendly pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = '1'
  })

  it('renders appointments page in e2e mode', async () => {
    vi.resetModules()
    const { default: AppointmentsPage } = await import('../src/app/appointments/page')
    render(await AppointmentsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '予約管理' })).toBeTruthy()
  })

  it('renders consents page in e2e mode', async () => {
    vi.resetModules()
    const { default: ConsentsPage } = await import('../src/app/consents/page')
    render(await ConsentsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '電子同意書管理' })).toBeTruthy()
    expect(screen.getByTestId('consent-management-panel')).toBeTruthy()
  })

  it('renders customers page in e2e mode', async () => {
    vi.resetModules()
    const { default: CustomersPage } = await import('../src/app/customers/page')
    render(await CustomersPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '顧客管理' })).toBeTruthy()
  })

  it('redirects dev appointments-kpi page to dashboard appointments-kpi', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    const { default: DevAppointmentsKpiPage } = await import('../src/app/dev/appointments-kpi/page')
    DevAppointmentsKpiPage()
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/appointments-kpi')
  })

  it('renders dev cron page when authorized', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })
    const { default: DevCronPage } = await import('../src/app/dev/cron/page')
    render(await DevCronPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Cron 監視' })).toBeTruthy()
  })

  it('renders billing alerts access denied message when unauthorized', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    requireDeveloperAdminMock.mockResolvedValue({ ok: false })
    const { default: BillingAlertsPage } = await import('../src/app/dev/billing-alerts/page')
    render(await BillingAlertsPage())
    expect(screen.getByText('このページはサポート管理者のみアクセスできます。')).toBeTruthy()
  })

  it('renders subscriptions access denied message when unauthorized', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    requireDeveloperAdminMock.mockResolvedValue({ ok: false })
    const { default: DevSubscriptionsPage } = await import('../src/app/dev/subscriptions/page')
    render(await DevSubscriptionsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText('このページはサポート管理者のみアクセスできます。')).toBeTruthy()
  })

  it('renders hotel page in e2e mode', async () => {
    vi.resetModules()
    const { default: HotelPage } = await import('../src/app/hotel/page')
    render(await HotelPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: 'ペットホテル管理' })).toBeTruthy()
  })

  it('renders inventory pages in e2e mode', async () => {
    const targets: Array<{ name: string; importer: () => Promise<{ default: (arg?: any) => Promise<JSX.Element> }> }> = [
      { name: '在庫履歴', importer: () => import('../src/app/inventory/history/page') },
      { name: '入庫登録', importer: () => import('../src/app/inventory/inbounds/page') },
      { name: '出庫登録', importer: () => import('../src/app/inventory/outbounds/page') },
      { name: '商品マスタ管理', importer: () => import('../src/app/inventory/products/page') },
      { name: '発注管理', importer: () => import('../src/app/inventory/purchase-orders/page') },
      { name: '発注提案一覧', importer: () => import('../src/app/inventory/reorder-suggestions/page') },
      { name: '在庫レポート', importer: () => import('../src/app/inventory/reports/page') },
      { name: '在庫一覧', importer: () => import('../src/app/inventory/stocks/page') },
      { name: '棚卸', importer: () => import('../src/app/inventory/stocktake/page') },
    ]

    for (const target of targets) {
      vi.resetModules()
      const mod = await target.importer()
      render(await mod.default({ searchParams: Promise.resolve({}) }))
      expect(screen.getByRole('heading', { level: 1, name: target.name })).toBeTruthy()
    }
  })

  it('renders journal page in e2e mode', async () => {
    vi.resetModules()
    const { default: JournalPage } = await import('../src/app/journal/page')
    render(await JournalPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '日誌' })).toBeTruthy()
  })

  it('renders ops today page in e2e mode', async () => {
    vi.resetModules()
    const { default: OpsTodayPage } = await import('../src/app/ops/today/page')
    render(await OpsTodayPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '当日運用（モバイル）' })).toBeTruthy()
  })

  it('renders payments page in e2e mode', async () => {
    vi.resetModules()
    const { default: PaymentsPage } = await import('../src/app/payments/page')
    render(await PaymentsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '会計管理' })).toBeTruthy()
  })

  it('renders pets page in e2e mode', async () => {
    vi.resetModules()
    const { default: PetsPage } = await import('../src/app/pets/page')
    render(await PetsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: 'ペット管理' })).toBeTruthy()
  })

  it('renders receipt page in e2e mode', async () => {
    vi.resetModules()
    const { default: ReceiptPage } = await import('../src/app/receipts/[payment_id]/page')
    render(await ReceiptPage({ params: Promise.resolve({ payment_id: 'pay-1' }) }))
    expect(screen.getByRole('heading', { level: 1, name: '領収書' })).toBeTruthy()
  })

  it('renders service menus page in e2e mode', async () => {
    vi.resetModules()
    const { default: ServiceMenusPage } = await import('../src/app/service-menus/page')
    render(await ServiceMenusPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: '施術メニュー管理' })).toBeTruthy()
  })

  it('renders staffs page in e2e mode', async () => {
    vi.resetModules()
    const { default: StaffsPage } = await import('../src/app/staffs/page')
    render(await StaffsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: 'スタッフ管理' })).toBeTruthy()
  })
})
