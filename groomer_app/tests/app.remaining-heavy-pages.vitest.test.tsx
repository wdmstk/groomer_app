import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStoreScopedClientMock } = vi.hoisted(() => ({
  createStoreScopedClientMock: vi.fn(),
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

vi.mock('@/components/customers/CustomerCreateModal', () => ({
  CustomerCreateModal: () => <div data-testid="customer-create-modal">customer-create-modal</div>,
}))
vi.mock('@/components/customers/CustomerMemberPortalControls', () => ({
  CustomerMemberPortalControls: () => <div data-testid="member-portal-controls">member-portal-controls</div>,
}))
vi.mock('@/components/pets/PetCreateModal', () => ({
  PetCreateModal: () => <div data-testid="pet-create-modal">pet-create-modal</div>,
}))
vi.mock('@/components/journal/JournalVisibilityToggleButton', () => ({
  JournalVisibilityToggleButton: () => <button type="button">journal-visibility</button>,
}))

vi.mock('@/components/medical-records/MedicalRecordShareButton', () => ({
  MedicalRecordShareButton: () => <button type="button">share</button>,
}))
vi.mock('@/components/medical-records/MedicalRecordVideoLineShareButton', () => ({
  MedicalRecordVideoLineShareButton: () => <button type="button">video-line-share</button>,
}))
vi.mock('@/components/medical-records/MedicalRecordAiProAnalyzeButton', () => ({
  MedicalRecordAiProAnalyzeButton: () => <button type="button">ai-pro</button>,
}))
vi.mock('@/components/medical-records/MedicalRecordAiProPlusAnalyzeButton', () => ({
  MedicalRecordAiProPlusAnalyzeButton: () => <button type="button">ai-pro-plus</button>,
}))

vi.mock('@/lib/supabase/store', () => ({
  createStoreScopedClient: createStoreScopedClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(() => null),
}))

vi.mock('@/lib/medical-records/photos', () => ({
  createSignedPhotoUrlMap: vi.fn(async () => new Map()),
}))
vi.mock('@/lib/medical-records/videos', () => ({
  createSignedVideoUrlMap: vi.fn(async () => new Map()),
}))

function createQueryResult(data: unknown, count = 0) {
  const query = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    gte: () => query,
    lte: () => query,
    not: () => query,
    in: () => query,
    or: () => query,
    order: () => query,
    range: () => query,
    limit: () => query,
    single: () => Promise.resolve({ data: null }),
    maybeSingle: () => Promise.resolve({ data: null }),
    then: (resolve: (value: { data: unknown; error: null; count: number }) => unknown) =>
      Promise.resolve({ data, error: null, count }).then(resolve),
  }
  return query
}

function createSupabaseStub() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'stores') {
        return createQueryResult([{ id: 'store-1', name: '店舗A', is_active: true }])
      }
      return createQueryResult([])
    }),
  }
}

describe('remaining heavy pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYWRIGHT_E2E = '1'
    createStoreScopedClientMock.mockResolvedValue({
      supabase: createSupabaseStub(),
      storeId: 'store-1',
    })
  })

  it('renders customers manage page in e2e mode', async () => {
    vi.resetModules()
    const { default: CustomersManagePage } = await import('../src/app/customers/manage/page')

    render(await CustomersManagePage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: '顧客ペット管理' })).toBeTruthy()
  })

  it('renders journal pet page in e2e mode', async () => {
    vi.resetModules()
    const { default: JournalPetPage } = await import('../src/app/journal/pets/[pet_id]/page')

    render(await JournalPetPage({ params: Promise.resolve({ pet_id: 'pet-001' }) }))

    expect(screen.getByText(/日誌アルバム/)).toBeTruthy()
  })

  it('renders medical records page in non-e2e mode with stubbed supabase', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: MedicalRecordsPage } = await import('../src/app/medical-records/page')

    render(await MedicalRecordsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: 'ペットカルテ管理' })).toBeTruthy()
  })

  it('renders visits page in non-e2e mode with stubbed supabase', async () => {
    process.env.PLAYWRIGHT_E2E = ''
    vi.resetModules()
    const { default: VisitsPage } = await import('../src/app/visits/page')

    render(await VisitsPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { level: 1, name: '来店履歴' })).toBeTruthy()
  })
})
