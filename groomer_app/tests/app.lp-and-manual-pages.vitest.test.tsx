import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import LandingPage from '../src/app/lp/page'
import ManualPage from '../src/app/manual/page'
import ManualGlossaryPageRoute from '../src/app/manual/glossary/page'

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

vi.mock('next/image', () => {
  return {
    default: ({
      src,
      alt,
      ...props
    }: {
      src: string
      alt: string
      [key: string]: unknown
    }) => <img src={src} alt={alt} {...props} />,
  }
})

vi.mock('../src/components/manual/ManualViewModeSwitch', () => {
  return {
    ManualViewModeSwitch: () => <div data-testid="manual-view-mode-switch">view-mode-switch</div>,
  }
})

describe('landing/manual pages', () => {
  it('renders landing page headline and primary CTA links', () => {
    render(<LandingPage />)

    expect(screen.getByRole('heading', { level: 1, name: /動画カルテ×AIで、提案までつながる/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'こんな課題をまとめて解消' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'まずは30日無料で試す' }).getAttribute('href')).toBe('/signup')
    expect(screen.getByRole('link', { name: '初期設定を代行してすぐに運用開始' }).getAttribute('href')).toBe('/signup')
  })

  it('renders manual index page title and glossary navigation', () => {
    render(<ManualPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'ユーザーマニュアル目次' })).toBeTruthy()
    expect(screen.getByTestId('manual-view-mode-switch')).toBeTruthy()
    expect(screen.getByRole('link', { name: '用語集ページを開く' }).getAttribute('href')).toBe('/manual/glossary')
  })

  it('renders manual glossary page title and back link', () => {
    render(<ManualGlossaryPageRoute />)

    expect(
      screen.getByRole('heading', { level: 1, name: '用語集（横文字・ステータスの説明）' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: '目次に戻る' }).getAttribute('href')).toBe('/manual')
  })
})
