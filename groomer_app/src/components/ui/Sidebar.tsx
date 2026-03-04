'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { StoreSwitcher } from './StoreSwitcher'

type StoreRole = 'owner' | 'admin' | 'staff' | ''

type NavLink = {
  href: string
  label: string
  ownerOnly?: boolean
  matchStartsWith?: boolean
}

type NavSection = {
  title: string
  links: NavLink[]
}

const navSections: NavSection[] = [
  {
    title: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード' },
      { href: '/dashboard/notification-logs', label: '通知ログ' },
      { href: '/dashboard/audit-logs', label: '監査ログ' },
      { href: '/manual', label: 'ユーザーマニュアル' },
    ],
  },
  {
    title: '顧客業務',
    links: [
      { href: '/customers', label: '顧客管理' },
      { href: '/pets', label: 'ペット管理' },
      { href: '/appointments', label: '予約管理' },
      { href: '/service-menus', label: '施術メニュー管理' },
      { href: '/medical-records', label: 'ペットカルテ管理' },
      { href: '/visits', label: '来店履歴' },
    ],
  },
  {
    title: '在庫・会計',
    links: [
      { href: '/inventory', label: '在庫管理', matchStartsWith: true },
      { href: '/payments', label: '会計管理' },
    ],
  },
  {
    title: '店舗設定',
    links: [
      { href: '/dashboard/setup-store', label: '新しい店舗を追加', ownerOnly: true },
      { href: '/staffs', label: 'スタッフ管理' },
      { href: '/support-chat', label: '問い合わせ' },
      { href: '/billing', label: 'サブスク課金', ownerOnly: true },
      { href: '/billing/history', label: '課金履歴', ownerOnly: true },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<StoreRole>('')
  const [userEmail, setUserEmail] = useState('')
  const persistedTitle = useSyncExternalStore(
    () => () => {},
    () => (typeof window === 'undefined' ? '' : window.sessionStorage.getItem('active_store_name') ?? ''),
    () => ''
  )
  const persistedRole = useSyncExternalStore(
    () => () => {},
    () =>
      (typeof window === 'undefined'
        ? ''
        : (window.sessionStorage.getItem('active_store_role') as StoreRole | null) ?? ''),
    () => ''
  )
  const persistedUserEmail = useSyncExternalStore(
    () => () => {},
    () => (typeof window === 'undefined' ? '' : window.sessionStorage.getItem('current_user_email') ?? ''),
    () => ''
  )
  const displayTitle = title || persistedTitle || '\u00A0'
  const activeRole = role || persistedRole || ''
  const displayUserEmail = userEmail || persistedUserEmail || 'メール未設定'
  const avatarLabel = (displayUserEmail[0] ?? '?').toUpperCase()
  const roleLabel = activeRole === 'owner' ? 'オーナー' : activeRole === 'admin' ? '管理者' : activeRole === 'staff' ? 'スタッフ' : '未設定'

  function handleActiveStoreNameChange(name: string) {
    setTitle(name)
    window.sessionStorage.setItem('active_store_name', name)
  }

  function handleActiveStoreRoleChange(nextRole: StoreRole) {
    setRole(nextRole)
    window.sessionStorage.setItem('active_store_role', nextRole)
  }

  function handleUserEmailChange(email: string) {
    setUserEmail(email)
    window.sessionStorage.setItem('current_user_email', email)
  }

  function isLinkActive(link: NavLink) {
    if (link.matchStartsWith) {
      return pathname.startsWith(link.href)
    }
    return pathname === link.href
  }

  const renderLinks = (onNavigate?: () => void) => (
    <nav className="space-y-2">
      <StoreSwitcher
        onActiveStoreNameChange={handleActiveStoreNameChange}
        onActiveStoreRoleChange={handleActiveStoreRoleChange}
        onUserEmailChange={handleUserEmailChange}
      />
      {navSections.map((section) => (
        <div key={section.title} className="pt-1">
          <p className="mb-1 px-2 text-xs font-semibold tracking-wide text-gray-500">{section.title}</p>
          <div className="space-y-1">
            {section.links.map((link) => {
              if (link.ownerOnly && activeRole !== 'owner') {
                return null
              }
              const isActive = isLinkActive(link)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={`block rounded p-2 transition-colors ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <Link
        href="/logout"
        onClick={onNavigate}
        className="block rounded p-2 text-red-600 transition-colors hover:bg-red-50"
      >
        ログアウト
      </Link>
    </nav>
  )

  const renderProfileSummary = (mobile = false) => (
    <div className={`rounded border bg-gray-50 ${mobile ? 'p-4' : 'mt-4 p-3'}`}>
      <p className="text-xs font-semibold tracking-wide text-gray-500">アカウント</p>
      <p className="mt-1 break-all text-sm font-medium text-gray-900">{displayUserEmail}</p>
      <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">ロール</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{roleLabel}</p>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label="メニューを開く"
          onClick={() => setIsOpen(true)}
          className="rounded border px-3 py-2 text-sm font-medium text-gray-700"
        >
          メニュー
        </button>
        <h2 className="max-w-[50%] truncate text-base font-bold text-gray-900">{displayTitle}</h2>
        <button
          type="button"
          aria-label="プロフィールを開く"
          onClick={() => setIsProfileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold text-gray-700"
        >
          {avatarLabel}
        </button>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 border-r bg-white p-4 lg:block">
        <h2 className="truncate text-xl font-bold">{displayTitle}</h2>
        {renderProfileSummary()}
        <div className="mt-4">
        {renderLinks()}
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white p-4 shadow-xl md:w-80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="max-w-[65%] truncate text-xl font-bold">{displayTitle}</h2>
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={() => setIsOpen(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                閉じる
              </button>
            </div>
            {renderLinks(() => setIsOpen(false))}
          </aside>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="プロフィールを閉じる"
            onClick={() => setIsProfileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <section className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">アカウント</h3>
              <button
                type="button"
                aria-label="プロフィールを閉じる"
                onClick={() => setIsProfileOpen(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                閉じる
              </button>
            </div>
            {renderProfileSummary(true)}
            <Link
              href="/logout"
              onClick={() => setIsProfileOpen(false)}
              className="mt-3 block rounded p-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              ログアウト
            </Link>
          </section>
        </div>
      )}
    </>
  )
}

