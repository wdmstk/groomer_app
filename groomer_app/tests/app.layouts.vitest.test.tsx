import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createStoreScopedClientMock, requireStoreFeatureAccessMock } = vi.hoisted(() => {
  return {
    redirectMock: vi.fn(),
    createStoreScopedClientMock: vi.fn(),
    requireStoreFeatureAccessMock: vi.fn(),
  }
})

vi.mock('next/navigation', () => {
  return {
    redirect: redirectMock,
  }
})

vi.mock('@/components/ui/Sidebar', () => {
  return {
    Sidebar: () => <aside data-testid="layout-sidebar">layout-sidebar</aside>,
  }
})

vi.mock('@/components/dev/DevSidebar', () => {
  return {
    DevSidebar: () => <aside data-testid="dev-layout-sidebar">dev-layout-sidebar</aside>,
  }
})

vi.mock('@/components/inventory/InventoryNav', () => {
  return {
    InventoryNav: () => <nav data-testid="inventory-layout-nav">inventory-layout-nav</nav>,
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

import AppointmentsLayout from '../src/app/appointments/layout'
import BillingLayout from '../src/app/billing/layout'
import CustomersLayout from '../src/app/customers/layout'
import DevLayout from '../src/app/dev/layout'
import InventoryLayout from '../src/app/inventory/layout'
import PaymentsLayout from '../src/app/payments/layout'
import PetsLayout from '../src/app/pets/layout'
import StaffsLayout from '../src/app/staffs/layout'
import SupportChatLayout from '../src/app/support-chat/layout'
import SupportTicketsLayout from '../src/app/support-tickets/layout'

function Child() {
  return <div data-testid="layout-child">layout-child</div>
}

describe('app layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders appointments layout with sidebar and children', () => {
    render(
      <AppointmentsLayout>
        <Child />
      </AppointmentsLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders billing layout with sidebar and children', () => {
    render(
      <BillingLayout>
        <Child />
      </BillingLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders customers layout with sidebar and children', () => {
    render(
      <CustomersLayout>
        <Child />
      </CustomersLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders pets layout with sidebar and children', () => {
    render(
      <PetsLayout>
        <Child />
      </PetsLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders staffs layout with sidebar and children', () => {
    render(
      <StaffsLayout>
        <Child />
      </StaffsLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders payments layout with sidebar and children', () => {
    render(
      <PaymentsLayout>
        <Child />
      </PaymentsLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders support-chat layout with sidebar and children', () => {
    render(
      <SupportChatLayout>
        <Child />
      </SupportChatLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders support-tickets layout with sidebar and children', () => {
    render(
      <SupportTicketsLayout>
        <Child />
      </SupportTicketsLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders inventory layout with nav and children', () => {
    render(
      <InventoryLayout>
        <Child />
      </InventoryLayout>,
    )

    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('inventory-layout-nav')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders dev layout with dev sidebar and children', () => {
    render(
      <DevLayout>
        <Child />
      </DevLayout>,
    )

    expect(screen.getByTestId('dev-layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('renders hq layout when feature access is allowed', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: { auth: {} },
      storeId: 'store-1',
    })
    requireStoreFeatureAccessMock.mockResolvedValue({ ok: true })
    vi.resetModules()
    const { default: HqLayout } = await import('../src/app/hq/layout')

    render(
      await HqLayout({
        children: <Child />,
      }),
    )

    expect(requireStoreFeatureAccessMock).toHaveBeenCalledWith({
      supabase: { auth: {} },
      storeId: 'store-1',
      minimumPlan: 'pro',
    })
    expect(screen.getByTestId('layout-sidebar')).toBeTruthy()
    expect(screen.getByTestId('layout-child')).toBeTruthy()
  })

  it('redirects hq layout to dashboard when feature access is denied', async () => {
    createStoreScopedClientMock.mockResolvedValue({
      supabase: { auth: {} },
      storeId: 'store-1',
    })
    requireStoreFeatureAccessMock.mockResolvedValue({ ok: false })
    vi.resetModules()
    const { default: HqLayout } = await import('../src/app/hq/layout')

    render(
      await HqLayout({
        children: <Child />,
      }),
    )

    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })
})
