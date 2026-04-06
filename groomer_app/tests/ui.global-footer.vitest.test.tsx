import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalFooter } from '../src/components/ui/GlobalFooter'

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

describe('GlobalFooter component', () => {
  it('renders legal links with expected href', () => {
    render(<GlobalFooter />)

    expect(screen.getByRole('link', { name: 'プライバシーポリシー' }).getAttribute('href')).toBe(
      '/legal/privacy',
    )
    expect(screen.getByRole('link', { name: '利用規約' }).getAttribute('href')).toBe('/legal/terms')
    expect(screen.getByRole('link', { name: 'セキュリティポリシー' }).getAttribute('href')).toBe(
      '/legal/security',
    )
    expect(screen.getByRole('link', { name: '特定商取引法に基づく表記' }).getAttribute('href')).toBe(
      '/legal/tokusho',
    )
  })
})
