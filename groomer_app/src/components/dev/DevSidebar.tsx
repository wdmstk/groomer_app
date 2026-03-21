'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type StoresResponse = {
  user?: {
    email?: string
  }
}

const navLinks = [
  { href: '/dev', label: '管理者ページ一覧' },
  { href: '/dev/subscriptions', label: 'サブスク課金管理' },
  { href: '/dev/cron', label: 'Cron 監視' },
  { href: '/dev/support-tickets', label: 'サポートチケット' },
  { href: '/dev/billing-alerts', label: '課金アラート' },
  { href: '/dev/manual', label: '管理者マニュアル' },
]

export function DevSidebar() {
  const pathname = usePathname()
  const [email, setEmail] = useState('メール未設定')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      const response = await fetch('/api/stores', { cache: 'no-store' })
      if (!response.ok || !isMounted) return

      const data = (await response.json()) as StoresResponse
      setEmail(data.user?.email ?? 'メール未設定')
    }

    void loadProfile()
    return () => {
      isMounted = false
    }
  }, [])

  const roleLabel = 'root'

  const renderCategoryTitle = (title: string) => (
    <div className="mb-1 flex items-center gap-2 px-2">
      <p className="shrink-0 text-xs font-semibold tracking-wide text-gray-500">{title}</p>
      <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
    </div>
  )

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="space-y-2">
      <div className="pt-1">
        {renderCategoryTitle('開発メニュー')}
        <div className="space-y-1">
          {navLinks.map((link) => {
            const isActive = link.href === '/dev'
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={`block rounded p-2 text-sm transition-colors ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="pt-1">
        {renderCategoryTitle('アカウント')}
        <div className="space-y-1">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="block rounded p-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            通常画面へ戻る
          </Link>
          <Link
            href="/logout"
            onClick={onNavigate}
            className="block rounded p-2 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            ログアウト
          </Link>
        </div>
      </div>
    </nav>
  )

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-20 border-b bg-white/95 backdrop-blur">
        <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="開発メニューを開く"
              onClick={() => setIsOpen(true)}
              className="rounded border px-3 py-2 text-sm font-medium text-gray-700 lg:hidden"
            >
              メニュー
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 lg:text-lg">開発者管理</h2>
              <p className="truncate text-[11px] font-semibold text-gray-500">
                Developer Console / {roleLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-64 truncate text-sm font-medium text-gray-600 lg:block">{email}</span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold text-gray-700">
              {roleLabel}
            </span>
            <Link
              href="/logout"
              className="hidden rounded border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 lg:inline-flex"
            >
              ログアウト
            </Link>
          </div>
        </div>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 border-r bg-white p-4 pt-20 lg:sticky lg:top-0 lg:block lg:overflow-y-auto">
        {renderNavLinks()}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="開発メニューを閉じる"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white p-4 shadow-xl md:w-80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">開発者管理</h2>
              <button
                type="button"
                aria-label="開発メニューを閉じる"
                onClick={() => setIsOpen(false)}
                className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                閉じる
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {renderNavLinks(() => setIsOpen(false))}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
