import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/components/ui/Sidebar'

const pushMock = vi.fn()

vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(''),
    useRouter: () => ({
      push: pushMock,
      refresh: vi.fn(),
    }),
  }
})

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

vi.mock('../src/components/ui/StoreSwitcher', () => {
  return {
    StoreSwitcher: () => <div data-testid="store-switcher-mock">store-switcher</div>,
  }
})

describe('Sidebar component', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    pushMock.mockClear()
    window.sessionStorage.setItem('active_store_name', '渋谷本店')
    window.sessionStorage.setItem('active_store_role', 'admin')
    window.sessionStorage.setItem('active_store_plan_code', 'light')
    window.sessionStorage.setItem('current_user_email', 'admin@example.com')
  })

  it('renders persisted store title and account summary', () => {
    render(<Sidebar />)

    expect(screen.getByText('渋谷本店')).toBeTruthy()
    expect(screen.getByText('店舗運用 / 管理者 / ライト')).toBeTruthy()
  })

  it('shows locked menus after toggling locked menu button', () => {
    render(<Sidebar />)

    expect(screen.queryByText('KPIレポート')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: '制限メニューを表示' })[0]!)

    expect(screen.getByText('KPIレポート')).toBeTruthy()
    expect(screen.getAllByText('プロ').length).toBeGreaterThan(0)
  })

  it('switches to hq mode and pushes /hq for admin role', () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: '本部運用' }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/hq')
  })
})
