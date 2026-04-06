import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireHqManualAccessMock, notFoundMock } = vi.hoisted(() => {
  return {
    requireHqManualAccessMock: vi.fn(),
    notFoundMock: vi.fn(),
  }
})

vi.mock('../src/app/hq/manual/access', () => {
  return {
    requireHqManualAccess: requireHqManualAccessMock,
  }
})

vi.mock('next/navigation', () => {
  return {
    notFound: notFoundMock,
  }
})

vi.mock('@/components/manual/ManualPages', () => {
  return {
    ManualIndexPage: ({ title }: { title: string }) => (
      <div data-testid="hq-manual-index-page">index:{title}</div>
    ),
    ManualGlossaryPage: ({ title }: { title: string }) => (
      <div data-testid="hq-manual-glossary-page">glossary:{title}</div>
    ),
    ManualSectionPage: ({ section }: { section: { id: string } }) => (
      <div data-testid="hq-manual-section-page">section:{section.id}</div>
    ),
  }
})

import HqManualGlossaryPage from '../src/app/hq/manual/glossary/page'
import HqManualPage from '../src/app/hq/manual/page'
import HqManualSectionPage from '../src/app/hq/manual/[sectionId]/page'

describe('hq manual pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NOT_FOUND')
    })
  })

  it('renders access denied message on hq manual index when access is denied', async () => {
    requireHqManualAccessMock.mockResolvedValue({ ok: false, message: 'ログインが必要です。' })

    render(await HqManualPage())

    expect(screen.getByRole('heading', { level: 1, name: '本部管理マニュアル' })).toBeTruthy()
    expect(screen.getByText('ログインが必要です。')).toBeTruthy()
  })

  it('renders hq manual index page when access is allowed', async () => {
    requireHqManualAccessMock.mockResolvedValue({ ok: true })

    render(await HqManualPage())

    expect(screen.getByTestId('hq-manual-index-page').textContent).toContain('本部管理マニュアル目次')
  })

  it('renders access denied message on hq manual glossary when access is denied', async () => {
    requireHqManualAccessMock.mockResolvedValue({
      ok: false,
      message: '本部マニュアルは owner/admin 権限のユーザーのみ利用できます。',
    })

    render(await HqManualGlossaryPage())

    expect(screen.getByRole('heading', { level: 1, name: '本部管理マニュアル用語集' })).toBeTruthy()
    expect(screen.getByText('本部マニュアルは owner/admin 権限のユーザーのみ利用できます。')).toBeTruthy()
  })

  it('renders hq manual glossary page when access is allowed', async () => {
    requireHqManualAccessMock.mockResolvedValue({ ok: true })

    render(await HqManualGlossaryPage())

    expect(screen.getByTestId('hq-manual-glossary-page').textContent).toContain('本部用語集')
  })

  it('renders hq manual section page when access is allowed', async () => {
    requireHqManualAccessMock.mockResolvedValue({ ok: true })

    render(
      await HqManualSectionPage({
        params: Promise.resolve({ sectionId: 'hq-access' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByTestId('hq-manual-section-page').textContent).toContain('section:hq-access')
  })

  it('throws notFound for unknown hq manual section', async () => {
    requireHqManualAccessMock.mockResolvedValue({ ok: true })

    await expect(
      HqManualSectionPage({
        params: Promise.resolve({ sectionId: 'unknown-hq-section' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NOT_FOUND')
  })
})
