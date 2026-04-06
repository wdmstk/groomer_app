import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  notFoundMock,
  requireDeveloperAdminMock,
  cookiesMock,
  cookieModeState,
} = vi.hoisted(() => {
  return {
    notFoundMock: vi.fn(),
    requireDeveloperAdminMock: vi.fn(),
    cookiesMock: vi.fn(),
    cookieModeState: { value: 'staff' },
  }
})

vi.mock('next/navigation', () => {
  return {
    notFound: notFoundMock,
  }
})

vi.mock('next/headers', () => {
  return {
    cookies: cookiesMock,
  }
})

vi.mock('@/lib/auth/developer-admin', () => {
  return {
    requireDeveloperAdmin: requireDeveloperAdminMock,
  }
})

vi.mock('@/components/manual/ManualPages', () => {
  return {
    ManualIndexPage: ({ title }: { title: string }) => (
      <div data-testid="manual-index-page">index:{title}</div>
    ),
    ManualGlossaryPage: ({ title }: { title: string }) => (
      <div data-testid="manual-glossary-page">glossary:{title}</div>
    ),
    ManualSectionPage: ({
      section,
      viewMode,
      pathPrefix,
    }: {
      section: { id: string }
      viewMode?: string
      pathPrefix: string
    }) => (
      <div data-testid="manual-section-page">
        section:{section.id}|view:{viewMode ?? 'none'}|prefix:{pathPrefix}
      </div>
    ),
  }
})

import DevManualGlossaryPage from '../src/app/dev/manual/glossary/page'
import DevManualPage from '../src/app/dev/manual/page'
import DevManualSectionPage from '../src/app/dev/manual/[sectionId]/page'
import ManualSectionPageRoute from '../src/app/manual/[sectionId]/page'

describe('manual and dev manual pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NOT_FOUND')
    })
    cookieModeState.value = 'staff'
    cookiesMock.mockResolvedValue({
      get: (key: string) => {
        if (key === 'manual_view_mode') return { value: cookieModeState.value }
        return undefined
      },
    })
  })

  it('renders manual section page with admin view mode when cookie is admin', async () => {
    cookieModeState.value = 'admin'

    render(
      await ManualSectionPageRoute({
        params: Promise.resolve({ sectionId: 'login' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByTestId('manual-section-page').textContent).toContain('section:login')
    expect(screen.getByTestId('manual-section-page').textContent).toContain('view:admin')
    expect(screen.getByTestId('manual-section-page').textContent).toContain('prefix:/manual')
  })

  it('throws notFound for unknown manual section id', async () => {
    await expect(
      ManualSectionPageRoute({
        params: Promise.resolve({ sectionId: 'unknown-section' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('renders dev manual index for developer admin', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })

    render(await DevManualPage())

    expect(screen.getByTestId('manual-index-page').textContent).toContain('管理者マニュアル目次')
  })

  it('renders access denied message on dev manual index when not admin', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: false })

    render(await DevManualPage())

    expect(screen.getByText('このページはサポート管理者のみアクセスできます。')).toBeTruthy()
  })

  it('renders dev manual glossary for developer admin', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })

    render(await DevManualGlossaryPage())

    expect(screen.getByTestId('manual-glossary-page').textContent).toContain('管理者用語集')
  })

  it('renders dev manual section for developer admin', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })

    render(
      await DevManualSectionPage({
        params: Promise.resolve({ sectionId: 'dev-home' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByTestId('manual-section-page').textContent).toContain('section:dev-home')
    expect(screen.getByTestId('manual-section-page').textContent).toContain('prefix:/dev/manual')
  })

  it('throws notFound for unknown dev manual section id', async () => {
    requireDeveloperAdminMock.mockResolvedValue({ ok: true })

    await expect(
      DevManualSectionPage({
        params: Promise.resolve({ sectionId: 'unknown-dev-section' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NOT_FOUND')
  })
})
