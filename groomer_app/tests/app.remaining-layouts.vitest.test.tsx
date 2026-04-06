import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

vi.mock('@/components/ui/Sidebar', () => ({
  Sidebar: () => <aside data-testid="remaining-layout-sidebar">remaining-layout-sidebar</aside>,
}))

vi.mock('@/components/dev/PointerCaptureGuard', () => ({
  PointerCaptureGuard: () => <div data-testid="pointer-capture-guard">pointer-capture-guard</div>,
}))

vi.mock('@/components/ui/GlobalFooter', () => ({
  GlobalFooter: () => <footer data-testid="global-footer">global-footer</footer>,
}))

vi.mock('@/components/ui/ThemeHydrator', () => ({
  ThemeHydrator: () => <div data-testid="theme-hydrator">theme-hydrator</div>,
}))

import ConsentsLayout from '../src/app/consents/layout'
import DashboardLayout from '../src/app/dashboard/layout'
import HotelLayout from '../src/app/hotel/layout'
import JournalLayout from '../src/app/journal/layout'
import LegalLayout from '../src/app/legal/layout'
import ManualLayout from '../src/app/manual/layout'
import MedicalRecordsLayout from '../src/app/medical-records/layout'
import OpsLayout from '../src/app/ops/layout'
import ServiceMenusLayout from '../src/app/service-menus/layout'
import VisitsLayout from '../src/app/visits/layout'

function Child() {
  return <div data-testid="remaining-layout-child">remaining-layout-child</div>
}

describe('remaining app layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'blue' }),
    })
  })

  it('renders root layout shell with initial theme from cookie', async () => {
    vi.resetModules()
    const { default: RootLayout } = await import('../src/app/layout')

    const html = renderToStaticMarkup(await RootLayout({ children: <Child /> }))

    expect(html).toContain('data-theme="')
    expect(html).toContain('theme-hydrator')
    expect(html).toContain('pointer-capture-guard')
    expect(html).toContain('global-footer')
  })

  it('renders legal layout back link and children', () => {
    render(
      <LegalLayout>
        <Child />
      </LegalLayout>,
    )

    expect(screen.getByRole('link', { name: '料金ページに戻る' }).getAttribute('href')).toBe('/lp')
    expect(screen.getByTestId('remaining-layout-child')).toBeTruthy()
  })

  it('renders sidebar-based remaining layouts', () => {
    const layouts = [
      <ConsentsLayout key="consents"><Child /></ConsentsLayout>,
      <DashboardLayout key="dashboard"><Child /></DashboardLayout>,
      <HotelLayout key="hotel"><Child /></HotelLayout>,
      <JournalLayout key="journal"><Child /></JournalLayout>,
      <ManualLayout key="manual"><Child /></ManualLayout>,
      <MedicalRecordsLayout key="medical"><Child /></MedicalRecordsLayout>,
      <OpsLayout key="ops"><Child /></OpsLayout>,
      <ServiceMenusLayout key="service"><Child /></ServiceMenusLayout>,
      <VisitsLayout key="visits"><Child /></VisitsLayout>,
    ]

    layouts.forEach((layout) => {
      const { unmount } = render(layout)
      expect(screen.getByTestId('remaining-layout-sidebar')).toBeTruthy()
      expect(screen.getByTestId('remaining-layout-child')).toBeTruthy()
      unmount()
    })
  })
})
