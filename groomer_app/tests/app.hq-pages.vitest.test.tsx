import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock } = vi.hoisted(() => {
  return {
    createServerSupabaseClientMock: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => {
  return {
    createServerSupabaseClient: createServerSupabaseClientMock,
  }
})

vi.mock('@/components/hq/HqMenuTemplateRequestForm', () => {
  return {
    HqMenuTemplateRequestForm: () => <div data-testid="hq-template-request-form">hq-template-request-form</div>,
  }
})

vi.mock('@/components/hq/HqMenuTemplateApprovalActions', () => {
  return {
    HqMenuTemplateApprovalActions: () => (
      <div data-testid="hq-template-approval-actions">hq-template-approval-actions</div>
    ),
  }
})

vi.mock('@/components/hq/HqHotelMenuTemplateRequestForm', () => {
  return {
    HqHotelMenuTemplateRequestForm: () => (
      <div data-testid="hq-hotel-template-request-form">hq-hotel-template-request-form</div>
    ),
  }
})

vi.mock('@/components/hq/HqHotelMenuTemplateApprovalActions', () => {
  return {
    HqHotelMenuTemplateApprovalActions: () => (
      <div data-testid="hq-hotel-template-approval-actions">hq-hotel-template-approval-actions</div>
    ),
  }
})

function createQueryResult<T>(data: T, error: { message: string } | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve: (value: { data: T; error: { message: string } | null }) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  }
  return query
}

function createSupabaseStub(config: {
  user: { id: string } | null
  memberships?: unknown[]
  menus?: unknown[]
  deliveries?: unknown[]
  subscriptions?: unknown[]
  hotelMenus?: unknown[]
  hotelDeliveries?: unknown[]
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: config.user } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'store_memberships') {
        return createQueryResult(config.memberships ?? [])
      }
      if (table === 'service_menus') {
        return createQueryResult(config.menus ?? [])
      }
      if (table === 'hq_menu_template_deliveries') {
        return createQueryResult(config.deliveries ?? [])
      }
      if (table === 'store_subscriptions') {
        return createQueryResult(config.subscriptions ?? [])
      }
      if (table === 'hotel_menu_items') {
        return createQueryResult(config.hotelMenus ?? [])
      }
      if (table === 'hq_hotel_menu_template_deliveries') {
        return createQueryResult(config.hotelDeliveries ?? [])
      }
      if (table === 'hq_store_daily_metrics_v1') {
        return createQueryResult([])
      }
      if (table === 'audit_logs') {
        return createQueryResult([])
      }
      return createQueryResult([])
    }),
  }
}

describe('hq pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login required message on hq dashboard when user is unauthenticated', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createSupabaseStub({ user: null }))
    vi.resetModules()
    const { default: HeadquartersPage } = await import('../src/app/hq/page')

    render(await HeadquartersPage({}))

    expect(screen.getByRole('heading', { level: 1, name: '本部ダッシュボード' })).toBeTruthy()
    expect(screen.getByText('ログインが必要です。')).toBeTruthy()
  })

  it('renders no-manageable-store message on hq dashboard', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'staff' }],
      }),
    )
    vi.resetModules()
    const { default: HeadquartersPage } = await import('../src/app/hq/page')

    render(await HeadquartersPage({}))

    expect(screen.getByText('owner または admin の所属店舗がありません。')).toBeTruthy()
  })

  // TRACE-323
  it('renders owner-only message on hq menu templates for admin role', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'admin', stores: { name: '店舗A' } }],
      }),
    )
    vi.resetModules()
    const { default: HqMenuTemplatesPage } = await import('../src/app/hq/menu-templates/page')

    render(await HqMenuTemplatesPage())

    expect(screen.getByText('この機能は owner のみ操作できます（admin は閲覧のみ）。')).toBeTruthy()
  })

  // TRACE-323
  it('renders hq template request form for owner role', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'owner', stores: { name: '店舗A' } }],
        menus: [{ id: 'menu-1', name: 'シャンプー', category: '基本', price: 3000, duration: 60 }],
      }),
    )
    vi.resetModules()
    const { default: HqMenuTemplatesPage } = await import('../src/app/hq/menu-templates/page')

    render(await HqMenuTemplatesPage())

    expect(screen.getByRole('heading', { level: 1, name: 'テンプレ配信リクエスト' })).toBeTruthy()
    expect(screen.getByTestId('hq-template-request-form')).toBeTruthy()
    expect(screen.getByText('店舗A (owner) / store-1')).toBeTruthy()
  })

  // TRACE-322
  it('renders read-only message on hq deliveries for admin role', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'admin' }],
        deliveries: [],
      }),
    )
    vi.resetModules()
    const { default: HqMenuTemplateDeliveriesPage } = await import(
      '../src/app/hq/menu-template-deliveries/page'
    )

    render(await HqMenuTemplateDeliveriesPage())

    expect(screen.getByRole('heading', { level: 1, name: 'テンプレ配信承認' })).toBeTruthy()
    expect(screen.getByText('admin は閲覧のみです。')).toBeTruthy()
  })

  // TRACE-321
  it('renders eligibility message on hq hotel menu templates when no pro+hotel owner store', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'owner', stores: { name: '店舗A' } }],
        subscriptions: [
          {
            store_id: 'store-1',
            plan_code: 'standard',
            hotel_option_effective: false,
            hotel_option_enabled: false,
          },
        ],
      }),
    )
    vi.resetModules()
    const { default: HqHotelMenuTemplatesPage } = await import(
      '../src/app/hq/hotel-menu-templates/page'
    )

    render(await HqHotelMenuTemplatesPage())

    expect(screen.getByText('Proプランかつホテルオプション有効な owner 所属店舗がありません。')).toBeTruthy()
  })

  // TRACE-321
  it('renders hq hotel template request form for eligible owner store', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'owner', stores: { name: '店舗A' } }],
        subscriptions: [
          {
            store_id: 'store-1',
            plan_code: 'pro',
            hotel_option_effective: true,
            hotel_option_enabled: true,
          },
        ],
        hotelMenus: [
          {
            id: 'hotel-menu-1',
            name: 'お預かり',
            item_type: 'stay',
            price: 5000,
            billing_unit: 'day',
            default_quantity: 1,
            duration_minutes: 60,
          },
        ],
      }),
    )
    vi.resetModules()
    const { default: HqHotelMenuTemplatesPage } = await import(
      '../src/app/hq/hotel-menu-templates/page'
    )

    render(await HqHotelMenuTemplatesPage())

    expect(screen.getByRole('heading', { level: 1, name: 'ホテルテンプレ配信リクエスト' })).toBeTruthy()
    expect(screen.getByTestId('hq-hotel-template-request-form')).toBeTruthy()
  })

  // TRACE-320
  it('renders read-only message on hq hotel deliveries for admin role', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createSupabaseStub({
        user: { id: 'user-1' },
        memberships: [{ store_id: 'store-1', role: 'admin' }],
        subscriptions: [
          {
            store_id: 'store-1',
            plan_code: 'pro',
            hotel_option_effective: true,
            hotel_option_enabled: true,
          },
        ],
        hotelDeliveries: [],
      }),
    )
    vi.resetModules()
    const { default: HqHotelMenuTemplateDeliveriesPage } = await import(
      '../src/app/hq/hotel-menu-template-deliveries/page'
    )

    render(await HqHotelMenuTemplateDeliveriesPage())

    expect(screen.getByRole('heading', { level: 1, name: 'ホテルテンプレ配信承認' })).toBeTruthy()
    expect(screen.getByText('admin は閲覧のみです。')).toBeTruthy()
  })
})
