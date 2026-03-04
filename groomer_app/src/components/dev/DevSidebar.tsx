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
  { href: '/dev/support-chat', label: '店舗チャット' },
  { href: '/dev/appointments-kpi', label: '予約作成KPI' },
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

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="space-y-2">
      {navLinks.map((link) => {
        const isActive = pathname === link.href
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
    </nav>
  )

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label="開発メニューを開く"
          onClick={() => setIsOpen(true)}
          className="rounded border px-3 py-2 text-sm font-medium text-gray-700"
        >
          メニュー
        </button>
        <h2 className="text-base font-bold text-gray-900">開発者管理</h2>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold text-gray-700">
          root
        </span>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 border-r bg-white p-4 lg:block">
        <h2 className="mb-4 text-lg font-bold text-gray-900">開発者管理</h2>
        <div className="mb-4 rounded border bg-gray-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-gray-500">アカウント</p>
          <p className="mt-1 break-all text-sm font-medium text-gray-900">{email}</p>
          <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">ロール</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{roleLabel}</p>
        </div>
        {renderNavLinks()}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="開発メニューを閉じる"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white p-4 shadow-xl md:w-80">
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
            <div className="mb-4 rounded border bg-gray-50 p-3">
              <p className="text-xs font-semibold tracking-wide text-gray-500">アカウント</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{email}</p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-gray-500">ロール</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{roleLabel}</p>
            </div>
            {renderNavLinks(() => setIsOpen(false))}
          </aside>
        </div>
      ) : null}
    </>
  )
}
